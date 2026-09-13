# Ski Race App — Architecture & Code Review

**Scope:** fault tolerance (crash / data-loss risk), DRY / dead code, and readiness for a
future requirement to push live results and overall completion results to a server.

**Date:** 2026-07-19

---

## Status (updated 2026-09-13)

Work is on branch `claude/approach-base-code-review-xwni12`. Section numbers refer to
the recommended order in §5 unless stated.

| Item | Status |
|---|---|
| 5.1 Silent loss on results entry | Done (ff6b98f) |
| 5.2 Transaction wrapper | Done (090b31a) |
| 5.3 Destructive sequences in transactions | Done (0de2e43); the three importers followed in this round |
| 5.4 Backups, preferences, migrations, FK repair | Done (090b31a). FK enforcement stays off deliberately; see the AASL note below before turning it on |
| §1.5 Clean shutdown | Done: the connection is closed on quit and before a menu-triggered relaunch, so the WAL is checkpointed into the `.db` file |
| 5.5 Dead-code purge | Done: 52 unreachable source files, 6 root codegen scripts, 5 migration docs and the unused jest setup script removed; `upload.csv` and the UI zip untracked |
| 5.6 De-duplicate the results components, with tests on the scoring logic | Done: one query builder, one factor table, pure scoring/grouping helpers with tests, and three shared result views replace the five clones and the two MUI tables |
| 5.7 Named-operation IPC layer and event log | Done for the hot paths: results entry, run lock/unlock, results import, start list regenerate and bib order, people merge. Every results write also appends to `result_events`. 32 write call sites on other pages still use the raw-SQL channels |
| §4 Dependency consolidation | Done: 11 unused packages removed, then MUI and Emotion once the last MUI tables went in 5.6 |

### Findings since the original review

- **Competitor CSV upload had been silently broken since the move to better-sqlite3
  (06a5b45).** better-sqlite3 rejects JS booleans as bound parameters, the upload bound
  checkbox/CSV flags directly, and the page never inspected the result, so every row
  failed and was counted as a success. Fixed: flags are bound as 0/1, the main-process
  wrapper now normalises any boolean it is handed, and the page reads the result.
- **Re-uploading an existing competitor reset their age category** because the update
  path ignored the birth year. Fixed.
- **The team start list page had never been routed, and has now been deleted.**
  `GenerateStartListTeam.js` was created in e7ae8e6 and never imported by anything; the
  UI migration then generated a `*New` copy of it. Its only team-specific content was two
  titles: the team-table joins and the female/HC team filter in its SQL were commented
  out, so it was a stale snapshot of the individual start list page, lacking the edit
  mode, two-run PDF and completed-run detection the live page gained later. Every race,
  team or individual, uses the routed start list page. If team races need a different
  start order, build it into that page behind an `is_team` branch.
- **Tooling was unrunnable.** `npm test` demanded a production build, `npm run lint`
  crashed in ts-node, and `tsc` was hidden behind a bogus `typeRoots`. All three run now
  and there is an `npm run typecheck` script. A one-off Prettier pass (commit
  "style: format the codebase with Prettier") cleared the formatting errors; lint now
  reports ~620 errors and ~180 warnings, all genuine rule violations (unused variables,
  components defined during render, unassociated labels) left for targeted fixes.
- **`upload.csv` in git history.** It was tracked despite the `*.csv` ignore rule and
  is untracked now. It contains fake data, so the history does not need rewriting.
- **AASL and foreign keys.** `aasl.service_number` declares a foreign key to
  `people(id)`, but the army-wide seed list legitimately contains people not yet
  registered in the app. That FK must be dropped before `PRAGMA foreign_keys = ON`.
- **Importing results into a locked run** used to bypass the lock; `results.importBatch`
  now refuses a run marked complete.
- `CHANGELOG.md` is the electron-react-boilerplate changelog, not this app's.
- Removed the 11 dependencies nothing imported after the purge, then `@mui/material`,
  `@emotion/react` and `@emotion/styled` once the two MUI result tables (which were
  imported but never rendered) and the MUI theme wrapper in the renderer entry went.
  `@electron/notarize` stays (used by `.erb/scripts/notarize.js`).
- **Results views (5.6).** The five race results components were near clones with
  inline SQL. They are now three views (individual, seeding, team) over one query
  builder in `queries/RaceResults.js`, a single factor table and points formula in
  `queries/fragments.js` shared with the seed and competitor-history queries, and pure
  helpers in `utils/raceResults.js` (mapping, DNS/DNF/DSQ partitioning, category
  podiums, team scoring) covered by unit tests. Fixed on the way: the one-run view
  re-queried the database on every render (effect with no dependency array); team
  top-three selection sorted on a field that did not exist; a run recorded as
  DNS/DNF/DSQ could still contribute its stored time as the winning time. Behaviour
  changes to note: NS is listed under DNS in both views (the two-run view listed it
  under DNF); a two-run total is blank until both runs are in (it previously showed
  the missing run as 9999 s); team points are rounded to two decimals in the table.
- **Team results filter inconsistency (decision needed).** The two-run team
  competition has always excluded corps and women's teams; the one-run competition
  never has. Both behaviours are preserved, now as one explicit `openTeamsOnly` flag
  per query in `queries/RaceResults.js`. Say which is intended and the other can match.
- **Named operations (5.7).** Writes on the hot paths no longer send SQL from the
  renderer. `src/main/operations` holds named operations (`results.saveFields`,
  `results.saveRunDetails`, `results.setRunComplete`, `results.importBatch`,
  `startList.regenerate`, `startList.saveBibOrder`, `people.merge`), each a function of
  `(tx, payload)` that validates its input and runs in one transaction; the renderer
  calls them through `window.api.operation` via the thin wrappers in
  `src/renderer/api/operations.js`. Locking a run now rebuilds the next run from the
  database rather than from React state, which also fixes the case where a stale
  competitor list could rebuild the wrong start order. The table definitions moved to
  `src/main/utils/schema.js` (no Electron import) so the operations are tested against
  a real in-memory SQLite via Node's built-in `node:sqlite` (Node 22.13+; the suite
  skips itself on older Node). The raw `db-select`/`db-insert`/`db-delete`/
  `db-transaction` channels remain for reads and for the pages not yet migrated.
- **Event log for sync (5.7).** `result_events(id, competition_id, race_id, run_number,
  racer_id, operation, payload, created_at, synced_at)` is appended inside every results
  operation's transaction, with a partial index on unsynced rows. This is the outbox a
  sync worker drains when live results go to a server: read unsynced rows in id order,
  post, set `synced_at`. Nothing reads it yet.

---

## Executive summary

The app is functionally rich but structurally fragile in exactly the two places you asked
about:

1. **Results can be silently lost today.** The live results-entry grid auto-saves each
   field with an error handler that only writes to the dev console. A failed write leaves
   the time on screen but not in the database; switching tabs later silently reverts it.
   Several routine operations (regenerating a start list, marking a run complete, merging
   two people) are delete-then-reinsert or multi-table sequences with **no transaction**,
   so a crash or error midway leaves the database in a partial state with no recovery
   path. There are no automatic backups, and the manual export does a plain file copy of
   a WAL-mode database, which can miss recent writes.

2. **The renderer sends raw SQL over IPC — 236 call sites in ~50 files.** This is the
   single biggest obstacle to the future server requirement. There is no single place
   where "a result was recorded" happens; it's an anonymous `UPDATE` string inside a page
   component. Until writes go through a named operation layer in the main process, there
   is nowhere to attach sync, validation, transactions, or an audit trail.

3. **Roughly 8,200 lines (~45 files) are dead code** from the old→New UI migration, plus
   600–800 lines of live copy-paste across the four results components (the seed-points
   SQL formula exists in 8 copies; the DNS/DNF/DSQ sort block in 30).

None of this needs a rewrite. The recommended path (§5) keeps the local-first SQLite
design and converges on server sync incrementally.

---

## 1. Fault tolerance / data-loss risks (priority order)

### 1.1 Silent save failures on the results-entry hot path — **highest priority**

`src/renderer/pages/race/RecordRaceResultsPageNew.js:482-525` — `updateField()` is the
auto-save behind every time, status, and DSQ field. On failure it only
`console.error`s. Compounding it:

- React state is updated optimistically *before* the awaited write
  (lines 391–408, 418–455), so the operator sees the value they typed even when it was
  never persisted. A later `fetchCompetitorsForRun` (tab switch) silently reverts it.
- Each time entry issues **5 sequential writes** (race_time + 4 status flags, lines
  404–408), each its own implicit transaction — a crash between them leaves
  contradictory state (e.g. a time recorded but DNF still set).
- `updateField` is a check-then-insert "upsert" (SELECT COUNT then INSERT/UPDATE) —
  two round trips where a single `INSERT ... ON CONFLICT DO UPDATE` would be atomic.
- Time inputs save on `onBlur` only (line 691–704): a value typed and not blurred
  (window closed, Enter+navigate) is never saved.

An `ErrorHandler.js` utility with toast notifications already exists
(`src/renderer/utils/ErrorHandler.js`) and is used by newer pages — but **not** by this,
the most critical page in the app.

### 1.2 Non-atomic multi-statement sequences

None of these use a transaction; each statement commits independently, so a crash or
mid-sequence error leaves partial state:

| Path | Location | Failure consequence |
|---|---|---|
| Regenerate start list | `GenerateStartListNew.js:145-217` | `DELETE` whole start list, then rebuild via `Promise.all` inserts. Crash after the delete = **entire start list lost**; partial insert = gapped/duplicate bibs. |
| Run-2 results rebuild | `RecordRaceResultsPageNew.js:581-660` (`createNextRunResults`, runs automatically on Mark Complete / Unlock) | `DELETE` run-2 results then repopulate from in-memory state. Crash after delete = run 2 gone; stale React state = stale rebuild. |
| Team start list save | `GenerateStartListTeamNew.js:158-225` | Two inserts per competitor in one `Promise.all`; also called twice (men/women) **without await** — fire-and-forget, errors invisible, batches race each other. |
| Merge people | `MergePeoplePageNew.js:108-179` | Sequential UPDATEs across 6 tables + 9 official columns, then `DELETE FROM people`. Crash = half-merged person; also throws mid-sequence on PK collision if both people share a competition entry. Explicitly "cannot be undone". |
| Create race | `CreateRacePageNew.js:106-118` | Race row then run rows in a loop; crash = race with no runs ("No runs found" downstream). |
| Seed-list finalisation | `CPPCalculation.js:159-215` + `GenerateSeedListNew.js:82-108` | Per-entry check-then-insert loop; CPP record and final list written as two separate steps — either can exist without the other. |
| Competitor create/update | `CompetitorManagement.js:39-215` | `people` insert then `competition_competitor` insert; crash between = person exists but not in competition, and re-import hits "already exists" — a stuck state. This is the per-row engine of the CSV importer. |

### 1.3 The `db-transaction` IPC handler is unsafe as written — fix before adopting it

`src/main/main.ts:157-185` + `src/main/utils/db.js:343-389`. The obvious remedy for §1.2
is the existing `db-transaction` channel — but it's currently a trap. It wraps
`BEGIN`/`COMMIT` around an **awaited async callback on the single shared connection**.
Every `await` is a yield point where the event loop can dispatch other pending
`db-insert`/`db-delete` IPC calls, which then execute *inside* the open transaction:

- A concurrent unrelated write gets committed or **rolled back** with someone else's
  transaction — invisible data loss.
- Two overlapping transactions throw "cannot start a transaction within a transaction".

better-sqlite3 provides the correct primitive: the synchronous `db.transaction(fn)`
wrapper, which executes with no yield points. The promise wrappers around what is a
synchronous library (`db.js:291-341`) add no value and create this hazard; they should
be removed along with the manual BEGIN/COMMIT methods.

### 1.4 Schema integrity is not enforced

- **Foreign keys are declared but never enforced** — SQLite requires
  `PRAGMA foreign_keys = ON` per connection; `db.js` never sets it. Nothing prevents
  orphaned results, and the people-merge (§1.2) relies on this being off.
- Several FK declarations are invalid anyway and would error if enforcement were turned
  on: `races` has composite PK `(competition_id, race_id)` but is referenced by
  `race_id` alone (`db.js:143,195,207,227`), and `race_results.run_number` references
  the non-unique `race_run.run_number` (`db.js:229`).
- **No schema migration system.** `CREATE TABLE IF NOT EXISTS` never alters existing
  databases, and `initializeDatabase` swallows creation errors (`db.js:275-289`). This
  is already biting:
  - `RaceTeamManagementNew.js:51` selects `ct.team_type`, which does not exist in the
    `competition_team` schema — `fetchTeams` errors on every load against a fresh DB.
  - `races.flip_count` exists in the schema but `fetchRaceDetails`
    (`RecordRaceResultsPageNew.js:56-60`) never selects it, so the flip-30 logic at
    line 302 always falls back to 15 and `flip_count_women` is never used anywhere.
- `CreateRacePageNew.js:247,255` binds altitude inputs to `name="altStart"` /
  `name="altFinish"`, which don't exist in `formData` — start/finish altitude are
  silently saved as `undefined` on every race create.

### 1.5 Backup and shutdown story

- **No automatic backups.** The only mechanism is manual File → Export
  (`db.js:392-420`), which does `fs.copyFileSync` on a **WAL-mode** database — the
  `-wal` file is not copied, so a backup taken mid-session can be missing recent writes
  or be inconsistent. Use `VACUUM INTO` or better-sqlite3's `db.backup()` instead.
- No `before-quit` handling: window close / `app.exit(0)` (menu database switching)
  terminate immediately with no drain of in-flight writes — combined with §1.2 this is
  a realistic way to lose a start list.
- `AppPreferences.loadPreferences` (`db.js:9-20`) **overwrites config.json with `{}`**
  on any read/parse error — a transient disk hiccup wipes the stored database path.
  Writes are also non-atomic (no write-temp-then-rename).
- No navigation guards anywhere (`beforeunload` / router prompt): unsaved form state —
  including a generated-but-unsaved team start list, edited bib order, and course
  details — is lost silently on back/close. Note the inconsistency on the results page:
  times auto-save on blur, course details on the same screen require an explicit Save.

### 1.6 Import paths

- `ImportRaceResultsPageNew.js`: per-row upsert with per-row try/catch; a failure
  produces a partial import reported only as "N failed" with no row identification.
  Malformed times return `null` from `parseTime` (lines 134–160) and the row is
  **silently skipped**; a mis-mapped bib column makes every row "not found" with only a
  count as feedback.
- `UploadCompetitorsPageNew.js:132-234`: minimal validation (names + service number
  only); gender silently defaults to `'M'`, seed to 2000; each row is itself a
  non-atomic two-table write (§1.2).
- `AASLManagement.js:67-132`: same per-row pattern, "completed with N errors".

Imports should run as one transaction (all-or-nothing) with a validation pass *before*
any write and a per-row error report.

---

## 2. DRY / dead code

### 2.1 Dead code from the UI migration (~8,200 lines, ~45 files)

`App.tsx:32` renders only `MyRoutesNew()`; the `USE_NEW_UI` flag at `App.tsx:9` is
`... || true` — permanently true, and `MyRoutes` is imported but never invoked.

| Bucket | Files | ~Lines |
|---|---|---|
| Old routes + `Layout`/`Sidebar` | 7 | 318 |
| Old pages with a `*New` sibling | 21 | 3,565 |
| Abandoned `*Refactored` util layer (`FetchSeedListRefactored`, `StartListPdfRefactored`, `BasePdfGenerator`, `seedCalculation/`) — never imported by live code | 6 | 935 |
| Old `RaceResult*` components (React bodies dead; **`RaceResult.js` and `RaceResultTwoRun.js` still export SQL strings consumed by the live `FetchSeedList.js`** — extract those before deleting) | 5 | 1,446 |
| Root one-off codegen scripts (`batch-migrate-pages.js`, `migrate-all-pages.js`, `fix-race-results.js`, `implement-*.js`, `update-to-searchable.js`) — referenced by nothing | 6 | 1,961 |

Plus the `MIGRATION_*.md` / `UI_*.md` docs, `Ski Race App UI Redesign.zip`, and
`upload.csv` at the repo root.

Notably, the `*Refactored` layer is a *cleaner* implementation of the seed/PDF logic
that was written and never wired in — the messy inline version and the clean extracted
version currently coexist.

### 2.2 Live duplication in the results components

`RaceResultOneRunNew` / `RaceResultTwoRunNew` / `RaceResultSeedNew` /
`RaceTeamResult{One,Two}RunNew` are near clones (~600–800 lines of copy-paste):

- The `factors` CTE (SL=730 / GS=1010) and the seed-points formula
  `ROUND((time - mintime) / mintime * factor, 2)` are pasted in **8 files**. A future
  change to the scoring formula must be found and fixed in all 8.
- The DNS/DNF/DSQ filter+sort block appears **30 times across 6 files**.
- `otherResultsColumns` / `categoryColumns` and the five category `<Card>` JSX blocks
  are byte-identical between OneRun and TwoRun.
- The extraction pattern already exists — `src/renderer/queries/` with
  `seedResults` used by `RaceResultSeedNew` — it was just only applied to one of the
  four components. Finishing that (shared query module + a `useRaceResults` hook + a
  shared category-tables component) collapses most of it.

### 2.3 No data-access layer

236 `window.api.*` call sites across ~50 renderer files, each with inline SQL.
`fetchPeople`, `fetchRaceDetails`-style wrappers, the check-then-insert upsert, and the
save-status/toast-timeout pattern (~120 occurrences across 43 pages) are re-implemented
per page. `ErrorHandler.js` and `useBackButton` are the right abstractions but adopted
inconsistently. This is both the main DRY issue and the main architectural blocker
(§3) — fixing one fixes the other.

---

## 3. Architecture: the future server / live-results requirement

The current design cannot grow a sync feature safely, for one reason: **writes have no
semantic identity.** "A result was recorded" is an anonymous SQL string constructed
inside a React component. There is no point in the system where you could say "when a
result changes, also send it to the server."

The good news is the fix is the same refactor that fault tolerance and DRY already
demand, and it does not disturb the local-first design:

1. **Move SQL into the main process behind named operations.** Replace
   `window.api.insert(sql, params)` with a typed API surface, e.g.
   `api.results.recordTime({competitionId, raceId, runNumber, racerId, time})`,
   `api.startList.regenerate(...)`, `api.people.merge(...)`. Each handler is a main-process
   function that owns its SQL. Migrate incrementally — page by page, hot paths first —
   while the legacy raw-SQL channels remain for not-yet-migrated pages.
2. **Make each named operation a real transaction** using better-sqlite3's synchronous
   `db.transaction(fn)` (after fixing §1.3). "Regenerate start list" becomes one atomic
   delete+rebuild; "merge people" becomes all-or-nothing; results entry becomes a single
   upsert.
3. **Add a change log (outbox) inside those transactions.** A
   `result_events(id, competition_id, race_id, racer_id, payload, created_at, synced_at)`
   append-only table, written in the same transaction as the result itself. This gives
   you, in order: an audit trail / recovery tool today, and the exact queue a sync
   worker needs tomorrow.
4. **Sync becomes a small, isolated main-process worker** that drains unsent events to
   the server when connectivity exists, retries with backoff, and marks rows synced.
   Race-venue connectivity is unreliable, so this store-and-forward shape (rather than
   write-through to the server) is the right model: the local DB remains the source of
   truth; the server is a read-only live mirror serving the results page.
5. **Overall/completion results:** compute them in shared query modules (§2.2) that both
   the local results pages and the sync payload builder call — otherwise the server
   feed and the on-screen results will drift.

Prerequisites from §1 that the server story also depends on: schema migrations with a
`user_version` (the server schema must track the client schema), FK enforcement, and
stable IDs (already good — UUIDs/service numbers).

---

## 4. Smaller observations

- `preload.ts:36-45` types are loose (`params: object`), and the `db-insert` channel is
  used for UPDATEs throughout — misleading naming; the named-operation API (§3) fixes both.
- `preload.ts:47-67` installs a global blur listener with a time regex that focuses the
  input back — validation logic hidden in the preload script; belongs in the input
  component (which already exists as the `race-time-input` handling in the design system).
- The whole-people-table load + `people.find()` per row for names
  (`RecordRaceResultsPageNew.js:92-100,208-211`) is O(n) per lookup — fine for hundreds,
  worth a `Map` for thousands.
- Only one test exists (`src/__tests__/App.test.tsx`, a smoke render). The seed-points
  formula, time parsing/formatting, flip logic, and CPP calculation are pure and
  eminently unit-testable — they're also exactly the logic that's copy-pasted, so tests
  are best added while extracting (§2.2).
- Dependency weight: MUI + Emotion + Flowbite + Radix + Tailwind coexist; danfojs *and*
  dataframe-js *and* xlsx *and* papaparse. Consolidating after the dead-code purge will
  cut install/build time and packaged size substantially.

---

## 5. Recommended order of work

1. **Stop silent loss on results entry** (small, immediate): route `updateField` and
   friends through `ErrorHandler` toasts, collapse the check-then-insert into
   `INSERT ... ON CONFLICT DO UPDATE`, and write the 5-field time save as one statement.
2. **Fix the transaction wrapper** (main process): synchronous `db.transaction(fn)`,
   delete the promise/BEGIN/COMMIT plumbing.
3. **Wrap the destructive sequences** in transactions: start-list regenerate, run-2
   rebuild, people-merge, imports (with pre-write validation), competitor create.
4. **Safety net**: automatic timestamped backup (`VACUUM INTO`) on app start and before
   destructive operations (merge, regenerate, import); fix preferences wipe-on-error;
   add `PRAGMA foreign_keys = ON` once the invalid FK declarations are corrected; add a
   `user_version`-based migration runner (which also fixes `team_type`).
5. **Delete the ~8,200 lines of dead code** (after extracting the two live SQL exports
   from `RaceResult.js` / `RaceResultTwoRun.js`).
6. **De-dupe the live results components** into shared queries + hook + components, with
   unit tests on the scoring/time logic as it's extracted.
7. **Introduce the named-operation IPC layer** page by page (hot paths first), adding
   the event-log table when results operations migrate — at which point the server sync
   feature is a small worker, not a rewrite.

Items 1–4 directly address "system crashes and results being lost" and are independent
of any UI work. Items 5–7 pay down DRY and set up the server requirement.

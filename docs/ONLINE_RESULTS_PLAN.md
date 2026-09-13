# Online live results and a central championship database

## Context

The Ski Race Results app is a local-first Electron + SQLite tool used by one race
secretary per meeting. Two new requirements extend it beyond the laptop:

1. **Online results site.** Competitors want to see race results as they are recorded,
   the finalised (official) results afterwards, and the current competition standings,
   on their phones, without waiting for the printed sheet.
2. **Central championship database.** Results from every meeting feed one online store
   so that when the corps meetings are complete their data is available to the
   qualifying championship organisers (seeding on arrival, Rules B3 and B12.a), and when
   the qualifying championships are complete Chairman Alpine can produce the Army
   Qualifiers List, the initial cut-off and the Army Initial Seed List (Rules B16 to B18).

The codebase was prepared for this in the 2026 review (`CODE_REVIEW.md` section 3): writes
on the results hot path go through named operations in the main process and append to an
outbox table, `result_events`, that nothing reads yet. This plan turns that groundwork into
the two features.

## Decisions already taken (confirmed 2026-09-13)

| Decision | Choice |
|---|---|
| Backend | Supabase: Postgres, PostgREST, Realtime, Edge Functions. SQL migrations kept in the repo under `supabase/migrations/`. |
| Cut-off | Computed centrally in an organiser web area (Chairman Alpine); the Electron app downloads the resulting lists as arrival seeds. |
| Organiser auth from the app | Per-meeting API key, issued centrally, pasted into the app's settings. No user accounts in the Electron app. Admin web area uses Supabase Auth magic links. |
| Sync model | Local-first, store-and-forward. The laptop's SQLite stays the source of truth; the server is an idempotent mirror plus the cross-championship store. One writer per meeting. |
| Tooling | Run `codegraph init -i` once implementation starts. |
| Branching | Create `development` from `master` (no such branch exists today). Every task below is a feature branch off `development` (`feat/...`, `chore/...`) merged by PR into `development`. `master` is untouched until a release is cut from `development`. |
| Team standings | Annex C basis: per race, the best three members' race points (existing `buildTeamResults`), summed across the team races; teams missing a race listed separately. The current total-seconds page is replaced. |
| Public visibility | Switched on in the admin area only by a meeting admin (who may be the race secretary with a login). The API key cannot publish a meeting. |
| Army-level arrival seeding | At an army-level competition initial points are the qualifying-derived points (`arrival_army_seed`, from the Army Initial Seed List) first, then the AASL. Nothing else: no corps seed, no 2000 default. An entry with neither is flagged on the seeding race start list as missing points rather than silently seeded. Non-army meetings keep the confirmed order AASL, then corps arrival seed, then 2000. |

### Branching and environments

- `development` is the integration branch. Feature branches are named per the repo
  convention (`feat/sync-outbox`, `feat/public-site-race-page`, ...) and squash-merged
  into `development` after CI is green.
- `master` only ever receives a merge from `development` when a release is cut, so the
  currently shipped desktop app and its release workflow (`.github/workflows/release.yml`,
  tag-triggered) are unaffected while this work is in progress.
- Two server environments follow the two branches: a **staging** Supabase project and
  staging site deployed from `development`, and a **production** Supabase project and
  site deployed from `master`. The Electron app's server URL is a setting, so a
  development build can point at staging.
- The new CI workflow (lint, typecheck, tests, `supabase db lint`) runs on pull requests
  into `development` and `master` and on pushes to both.

## The championship ladder (from the AWSA Alpine Rules 2025)

```
Corps meetings / CTC / Ex Snow Lion
        │  final seed list + CPP + full race data (B12.a) → seeding on arrival (B3)
        ▼
Qualifying Championships (Ex SPARTAN HIKE, Ex PIPEDOWN)
        │  seed list after race 4 → provisional Army Qualifiers List (B17.a/b)
        │  final seed list after race 5 → confirmed list + Army Initial Seed List (B17.c, B18)
        ▼
Army Alpine Ski Championships
        │  final seed list (≥4 races completed) → AASL for next season (B12.c, B19–B21)
        ▼
Army Alpine Seed List (AASL): the base list for all seeding (B1)
```

Facts that shape the design:

- Places at the Army meeting: 100 individual men, 15 individual women, adjustable by
  Chairman Alpine (215.5.1, B16). A unit team needs three individually qualified members;
  the fourth then goes forward unqualified (B16, 215.6.1.d). Up to five HC places and
  215.6 exceptions with Chairman-allotted points.
- The cut-off is one merged, CPP-normalised ranking across all qualifying meetings,
  truncated at the 100th best figure; it is not a per-corps quota (B17.b).
- Eligibility: at least two championship races completed by the after-race-4 point (B9.c).
  Competitors may opt out of Army qualification (B17.a).
- CPP (Appendix 1) needs the AASL points of the skiers on the meeting seed list, and a
  subjective penalty multiple (PM) may be applied by Chairman Alpine.
- Identity across meetings is the army service number, already `people.id` in the app.
  Service numbers must never appear on the public site.
- Results publication has no formal provisional/official state in the rules: a DSQ notice
  with time of posting, a 15-minute protest window on sanctions (640), and the TD's
  signature on the Annex E sheet. The app has only `race_run.is_complete`. A race status
  for the public site has to be introduced.
- Rule 3.a still mandates the XLSki package at Army and Qualifying Championships. Flag to
  the AWSA before this system is used there; not a software task.

## What exists today (pointers)

- Schema: `src/main/utils/schema.js`. Natural composite keys everywhere; `people.id` is the
  service number; `competitions` has only id, name and description (no level, season or
  dates); `competition_competitor.arrival_army_seed` exists and is unused; the finalised
  seed list is stored in `competition_final_seed_list` with CPP in `competition_cpp`.
- Named operations: `src/main/operations/` (`index.js` registry, `results.js`,
  `startList.js`, `people.js`, `validate.js`), renderer wrappers in
  `src/renderer/api/operations.js`, IPC channel `db-operation` in `src/main/main.ts`.
- Outbox: `result_events`, written by `recordEvent()` in `src/main/operations/results.js`
  for `results.saveFields`, `results.setRunComplete`, `results.importBatch` only. Thirty-two
  raw-SQL write call sites remain in the renderer (competitions, races, competitors, teams,
  AASL import, seed list finalisation) and emit no events.
- Scoring, pure and tested: `src/renderer/queries/fragments.js` (discipline factors,
  race points), `src/renderer/queries/RaceResults.js`, `src/renderer/utils/raceResults.js`
  (mapping, DNS/DNF/DSQ partition, category podiums, team best-three),
  `src/renderer/utils/FetchSeedList.js` (B5–B13 seed list with penalty flags),
  `src/renderer/utils/CPPCalculation.js`, `src/renderer/utils/CompetitorManagement.js`
  (`calculateCategory`). Competition standings: `src/renderer/pages/results/individualNew.js`
  (sum of race points across completed individual races). Team standings in
  `pages/results/teamNew.js` sum raw seconds and disagree with the per-race team scoring;
  do not mirror as-is.
- Preferences: `AppPreferences` in `src/main/utils/db.js` (JSON file, `databasePath` only,
  not exposed over IPC). Migrations: ad-hoc `applyColumnMigrations()`, no `user_version`.
- Tests: Jest 29; SQL-backed suites use `node:sqlite` in memory (Node 22.13+), pattern in
  `src/__tests__/operations.test.js`. CI: release workflow only; nothing runs tests.
- No HTTP client code anywhere. Electron 39, so `fetch` is available in the main process.

## Personas

| Persona | Where | Needs |
|---|---|---|
| Competitor | Phone at the venue or at home | See own and others' times as they are recorded, official results, standings, start lists. No login. |
| Team captain | Phone | Team race results and team standings; who is scoring. |
| Race secretary | Electron app at a meeting, unreliable connectivity | Results reach the site and the central store without extra work; see sync state; control what is published; mark opt-outs. |
| Registration desk (qualifying or Army meeting) | Electron app | Look up an arriving competitor's prior seed points and CPP; import feeder lists as arrival seeds. |
| Chairman Alpine / AWSA Alpine Secretary | Organiser web area | Authorise CPP and PM per meeting, produce the provisional and confirmed Army Qualifiers Lists and the Army Initial Seed List, apply overrides with reasons, publish; later, produce the AASL. |
| System admin | Organiser web area | Create meetings and seasons, issue and rotate API keys, publish or unpublish, audit ingest. |

## User stories and acceptance criteria

### Epic A: Publish from the app (foundation for both requirements)

- **A1** As a race secretary, I set a competition's level (corps, qualifying, army, other),
  season, dates and venue when I create or edit it, so the central store can place it on
  the ladder. *AC: fields required on create; existing competitions get a migration with
  nulls and a prompt to complete them; values sync.*
- **A2** As a race secretary, I paste the meeting API key and server URL once, test the
  connection, and the app links this competition to its central meeting. *AC: settings
  stored in the preferences file per competition; "Test connection" reports success or
  a readable error; key never shown in full again.*
- **A3** As a race secretary, every change I make (competitors, teams, races, runs, start
  lists, results, run locks, seed list snapshots, finalised seed list and CPP) reaches the
  server automatically when connectivity exists, in the order I made it, without blocking
  the UI. *AC: each write appends an event in the same transaction; a background worker
  drains in order with retry and backoff; pending count visible; no duplicate rows on the
  server after retries or app restarts.*
- **A4** As a race secretary, I can see sync status at a glance (pending, last success,
  last error) and force "Sync now". *AC: sidebar indicator; sync log page listing events,
  attempts and errors; a rejected event does not block later events forever and is shown
  for action.*
- **A5** As a race secretary, I control whether my competition syncs at all, and can mark a
  competitor "do not publish"; as a meeting admin, I switch the meeting's public visibility
  on or off in the admin area. *AC: unpublished meetings are invisible to anonymous readers
  even when synced; the API key cannot change visibility; a do-not-publish competitor is
  withheld from public views by name and unit but still counted in positions (position
  numbers stay correct, name shown as "Withheld").*
- **A6** As a race secretary, I can bring an in-progress competition fully online in one
  action ("Publish everything"), and re-publish after a server reset. *AC: a full snapshot
  of the competition is enqueued and applied idempotently.*
- **A7** As a race secretary, I mark each race official when the results are confirmed
  (after the DSQ notice and protest window), and can revert. *AC: race status moves
  scheduled → live → provisional (all runs locked) → official (explicit action); the
  public site shows the status and time.*

### Epic B: Public live results site

- **B1** As a competitor, I open a link or QR code for the meeting on my phone and see the
  list of races with today's races first, each with its status. *AC: mobile-first, loads
  in under two seconds on 3G, no login.*
- **B2** As a competitor, I see a race's results update as times are recorded, with
  positions, bib, rank, name, team, class, run times, total and race points, plus DNS/DNF/
  DSQ lists per run, matching the printed sheet. *AC: new rows appear within a few seconds
  of the laptop syncing; "Last updated HH:MM" is shown; live results are labelled
  unofficial.*
- **B3** As a competitor, I see the start list and bib order for a run before it starts,
  including the second-run flip. *AC: start list published when generated; run 2 order
  visible once run 1 is locked.*
- **B4** As a competitor, I see category podiums (open, female, junior, veteran, novice)
  for each race. *AC: matches `categoryPodiums` output in the app.*
- **B5** As a competitor, I see the competition standings: individual combined (sum of
  race points across completed championship races) overall and per category, and the seed
  list after N races with penalty markers. *AC: identical to the app's tables for the same
  data (guarded by a shared test fixture).*
- **B6** As a team captain, I see team results per race (best three, total time and
  points, disqualified teams, HC teams positioned separately) and team standings.
  *AC: per Rule 617.4; standings on the Annex C basis (sum of best-three race points per
  team race), identical to the app's replacement team standings page.*
- **B7** As a competitor, I can find myself by name or bib and see my results across the
  meeting. *AC: search by name or bib; no service numbers anywhere in the public site or
  its API responses.*
- **B8** As a competitor, I can download the official PDF results sheet once it is
  official. *AC: organiser's PDF stored and linked (optional in phase 1).*
- **B9** As a competitor with poor signal, the site tells me when the data is stale.
  *AC: staleness banner if the last successful ingest for the meeting is older than a
  threshold while a race is live.*

### Epic C: Central store and seeding between championships

- **C1** As a system admin, I create a season and meetings with level, dates, organiser
  contact and which higher-level meeting each feeds, and issue or rotate the meeting's API
  key. *AC: key shown once; hash stored; rotation invalidates the old key.*
- **C2** As the server, I accept batches of events from a meeting's app, validate them
  against the key and schema version, apply them atomically and idempotently, and report
  per-event rejections without losing the rest of the batch. *AC: replaying a batch
  changes nothing; a malformed event is rejected with a reason; audit row per batch.*
- **C3** As a race secretary at a qualifying meeting, at registration I look up an arriving
  competitor by service number and see their AASL points and their corps-meeting final
  seed points, CPP and race count for the last three seasons, with a suggested arrival seed
  following the B3 precedence, which I can accept or override. *AC: works online only;
  offline shows a clear message; accepted value lands in `arrival_corps_seed`.*
- **C4** As a race secretary, I can import a whole feeder list (a corps meeting's final
  seed list, or the Army Initial Seed List for the Army meeting) into my competition as
  arrival seeds. *AC: matches on service number; unmatched rows listed; nothing written
  unless confirmed; Army list writes `arrival_army_seed`.*
- **C5** As a race secretary, I mark competitors who do not wish to be considered for
  Army qualification. *AC: flag on the competition entry, synced, honoured by the engine.*
- **C6** As a race secretary, I download the current season's AASL into the app instead of
  importing a spreadsheet (once the AASL is produced centrally, Epic E). *AC: same table
  as the spreadsheet import populates.*

### Epic D: Qualification and cut-off engine (organiser web area)

- **D1** As Chairman Alpine, I see for an Army meeting which qualifying meetings feed it and
  whether their after-race-4 seed list and final seed list have arrived.
- **D2** As Chairman Alpine, I review each meeting's CPP (T1, T2, T3, skiers used), authorise
  it and set a penalty multiple with a reason.
- **D3** As Chairman Alpine, I run the provisional round: CPP and PM applied per meeting,
  lists merged, opt-outs removed, under-two-races competitors marked ineligible, men and
  women ranked separately, top 100 men and top 15 women (adjustable), fourth members of
  teams with three qualifiers admitted, HC places, and 215.6 exceptions added manually
  with allotted points. *AC: every candidate row shows source meeting, raw and adjusted
  points, eligibility reason, penalty-award flag and outcome; ties at the boundary are
  surfaced for decision; totals shown.*
- **D4** As Chairman Alpine, I apply manual overrides with a reason and they are audited.
- **D5** As Chairman Alpine, I publish the Army Qualifiers List to meeting secretaries
  (visible in the organiser area, exportable CSV and PDF, optionally on the public site
  without service numbers).
- **D6** As Chairman Alpine, I run the confirmed round after race 5 and produce the Army
  Initial Seed List, which the Army meeting's app imports (C4).

### Epic E: AASL production (later)

- **E1** As the AWSA Alpine Secretary, after the Army Championships I generate the next
  season's AASL: CPP/PM-adjusted final seed points from the Army and qualifying meetings,
  15% penalty for non-racers, removal after two idle seasons or over 500 points, then
  distribute it. *AC: per B19–B21; every row shows its derivation; export and app download.*

### Cross-cutting (non-functional)

- Data protection: names, rank and unit of serving personnel are published only for
  published meetings; service numbers stay in the organiser area; per-competitor withhold
  flag; API keys hashed at rest; audit of ingest and admin actions.
- Consistency: the same scoring code produces the app's tables and the site's tables, or
  the site renders snapshots the app produced. A shared fixture test guards drift.
- Schema versioning: events carry a schema version; the app has a `user_version`
  migration runner; the server rejects unknown versions clearly.
- Testing per repo rules: tests alongside every step, node:sqlite for app operations,
  Vitest for shared and web code, SQL tests for server functions; a CI workflow that runs
  them (none exists today).

## Architecture

```
┌──────────────── Race secretary's laptop (Electron) ────────────────┐
│ renderer pages ──► named operations (main, one transaction each)    │
│                          │ writes table + appends sync_events        │
│                          ▼                                           │
│                   sync worker (main): drains in id order, batches,   │
│                   POST /ingest with meeting API key, backoff,        │
│                   dead-letters rejected events, pings every 60 s     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS, store-and-forward
┌──────────────────────────────▼──────────────────────────────────────┐
│ Supabase                                                             │
│  Edge Functions: ingest, ping, query (pull-downs), exports, notify   │
│  Postgres: private mirror (service-number keyed) ── RLS ──          │
│            public_* views (no PII) ── Realtime broadcast per meeting│
│            qualification engine (plpgsql) + AASL rounds             │
└───────────┬───────────────────────────────┬─────────────────────────┘
            │ anon reads views + broadcast   │ magic-link auth
┌───────────▼───────────┐       ┌───────────▼────────────────────────┐
│ Public site (apps/web)│       │ Admin area (/admin, same app)      │
│ Cloudflare Pages      │       │ meetings, keys, publish, official, │
│                       │       │ ingest log, cut-off screens        │
└───────────────────────┘       └────────────────────────────────────┘
```

### Repository layout (npm workspaces)

```
packages/scoring/        @awsa/scoring: pure JS moved verbatim from src/renderer/utils and
                         queries/fragments.js (raceResults, seedList core, cpp, category, time,
                         math, factors) + new standings builders; Vitest; shared golden fixtures
packages/sync-contract/  @awsa/sync-contract: TS types + zod schemas for the event envelope,
                         fixtures/batch.v1.json used by both the app tests and pgTAP
apps/web/                Vite + React 18 + TS + Tailwind 3 (preset from tailwind.config.js),
                         shadcn set copied from new_ui/ with version suffixes stripped
supabase/                config.toml, migrations/, functions/, tests/ (pgTAP), seed.sql
src/                     the Electron app, unchanged in shape; utils become re-exports from
                         @awsa/scoring for one release, then callers import the package
```

Root changes: `workspaces`, `jest.testPathIgnorePatterns` += `packages/`, `apps/`; `tsconfig.json`
`exclude` += `apps`, `supabase`, `packages/*/test`; `.eslintignore` += the same; do not add
`@awsa/scoring` to root `dependencies` (the dev DLL bundles root deps; workspaces link anyway).
The Electron build is unaffected: electron-builder packages `release/app` only and ts-loader
transpiles the symlinked package.

### The sync contract (reconciled, v1)

One contract binds the Electron worker, the ingest function and the pgTAP tests. Where the two
designs differed, the choice below wins.

- **Event identity**: `event_id` is the local `sync_events.id` (integer, monotonic per
  installation). Idempotency key on the server is `(installation_id, event_id)`. If the app
  detects a restored backup (`MAX(sync_events.id)` below `sync_state.last_synced_event_id`) it
  mints a new `installation_id` and enqueues a full snapshot, so ids never collide.
- **Granularity**: full-row upserts (the operation reads the row back inside its transaction
  and emits it) or whole-collection replaces. Deletes carry the key only. Replays converge.
- **Keys** use server vocabulary: `service_number` (not `racer_id`), `race_id`, `run_number`,
  `team_id`, `after_race_count`, `kind`. The meeting is in the envelope, not in each key.
- **Entity types**: `meeting`, `competitor`, `competitor_merge`, `meeting_entry`, `team`,
  `team_members` (collection per team and race; `race_id` may be null meaning "nominated for
  the meeting"), `race`, `race_run`, `start_list` (collection), `result`, `race_scores`
  (collection, on final-run lock), `seed_list_snapshot`, `standings_snapshot`, `cpp`,
  `final_seed_list`, `snapshot_marker` (no-op on the server in v1, reserved for stale-row
  clean-up after a full snapshot).
- **Officials, course setters and forerunners** are sent as display strings, formatted as
  `src/renderer/utils/RaceDetails.js` does today, never as service numbers.
- **Envelope**: `{installation_id, meeting_id, schema_version, app_version, hostname,
  events:[{event_id, entity_type, operation:'upsert'|'delete', key, data, occurred_at}]}`,
  header `x-api-key`, at most 500 events or 1 MiB.
- **Response** `200 {accepted_up_to_event_id, applied, duplicates, rejected:[{event_id, code,
  reason}], server_time}`. Everything at or below `accepted_up_to_event_id` is marked synced;
  rejected ids are marked dead with the reason and never retried (deterministic data errors);
  later events in the batch still apply.
- **Errors**: 401 bad or revoked key; 403 key belongs to another meeting; 409 unsupported
  `schema_version` (body lists supported); 413 too large (worker halves the batch); 429 with
  `retry_after_seconds`; 5xx or non-JSON 2xx (captive portals) = retry the identical batch
  with jittered exponential backoff, capped at five minutes.
- **Ping** `POST /ping` with the key returns the meeting (id, slug, name, level, season,
  timezone, is_published), supported schema versions and limits; the app stores the meeting id
  and shows the server's level and season next to its own.
- **Race status** is server-derived (`scheduled` → `live` on first result → `provisional` when
  every run is locked → back to `live` on unlock) except `official` and `cancelled`, which the
  app or the admin area set explicitly. `results_posted_at` is stamped on entering
  `provisional`; `dsq_notice_posted_at` starts the 15-minute protest clock shown publicly.
- **Two switches, two places**: the app has "sync enabled" per competition (local); the
  server has `meetings.is_published` (public visibility), admin-only so a leaked key can never
  publish a meeting. Per-entry `do_not_publish` withholds name and unit but keeps the row in
  rankings.

### Where each number is computed

| Data | Computed by | Rationale |
|---|---|---|
| Live per-run times, statuses, positions, race points | Postgres view `race_result_rows`, a port of `buildRaceResultsQuery` | Trivial window functions, updates on every ingest |
| Locked-race positions and points | App-pushed `race_scores` (the same query the PDF uses); public view prefers them | Published numbers equal the signed sheet; rounding drift confined to the live phase |
| DNS/DNF/DSQ partition, podiums, team best-three, class code | `@awsa/scoring` in the browser on view rows | Same functions the app uses |
| Seed list after N races, CPP, final seed list, standings | App-pushed snapshots from `FetchSeedList.js`, `CPPCalculation.js` and the new standings builders | Stateful B13 logic already tested; not worth a SQL port |
| Qualification cut-off, Army Initial Seed List, AASL | Postgres functions in the organiser area | Set-based, transactional, audited under the caller's identity; CPP re-implemented in SQL and tied to the JS test cases |

Drift guards: a golden race-scoring fixture run by Jest against `node:sqlite` and by pgTAP
against `race_result_rows`; `race_factors` table asserted equal to `RACE_FACTORS`; an admin
drift view listing any locked race where SQL and app scoring disagree; the contract fixture
applied by pgTAP and serialised by the worker test.

### Local schema changes (Electron)

Migration runner on `PRAGMA user_version` in a new Electron-free `src/main/utils/migrations.js`;
`TABLE_SCHEMAS` is frozen as the version 1 baseline and everything later is a migration.

- v1: today's `applyColumnMigrations` list and FK repair, moved; drop the `aasl.service_number`
  FK (the AASL legitimately holds people not registered locally).
- v2: `competitions` + `level, season, start_date, end_date, venue, remote_meeting_id,
  sync_enabled, updated_at`; `competition_competitor` + `army_qual_opt_out, do_not_publish`;
  `races` + `status ('scheduled'|'official'|'cancelled' locally), official_at,
  dsq_notice_posted_at`; backfill `competition_team_members.competition_id` where null.
- v3: `sync_events` (id, event_id, entity_type, entity_key, op, payload, operation,
  schema_version, snapshot_id, status pending|synced|dead|superseded, attempts,
  last_attempt_at, last_error, created_at, synced_at), `sync_state` per competition,
  `seed_list_snapshots` (local copy of every published snapshot); `result_events` stops being
  written and is dropped in a later migration.

Preferences (`config.json`) gain `installationId` and `sync.competitions[localId] = {apiKey,
serverUrl}`; the key is stored with Electron `safeStorage` where available.

### Supabase schema (summary; DDL in the design notes)

- Foundation: `seasons`, `meetings` (slug, level, season, dates, venue, timezone, organiser
  contact, `feeds_meeting_id`, `is_published`, `qualifies_for_aasl`, freshness columns),
  `admin_users` (role chairman | alpine_secretary | organiser), `meeting_admins`,
  `meeting_api_keys` (SHA-256 hash, prefix, revoked_at), `api_key_usage`, `installations`.
- Meeting data: `competitors` (service number, private), `meeting_entries` (flags, arrival
  seeds and their source, `do_not_publish`, `army_opt_out`), `teams`, `team_members` (surrogate
  id, unique nulls-not-distinct on team, race, entry), `races` (+ status, timestamps,
  officials as jsonb display strings), `race_status_history`, `race_runs`,
  `start_list_entries`, `results`, `race_scores`, `race_factors`.
- Snapshots: `seed_list_snapshots` (+rows with penalty race ids, championship races completed,
  awarded-points count, `is_final`), `standings_snapshots` (+rows), `meeting_cpp`,
  `final_seed_lists` (+rows denormalised with competitor id), `aasl` (per season, with source
  and last competed season), `documents` (Storage references).
- Sync: `sync_events` ingest log (unique installation + event id, payload purged after 180
  days), `apply_sync_events(jsonb)` with a savepoint per event, entity appliers,
  `touch_api_key` (auth + per-minute rate limit), race status triggers, `sync_broadcast`
  via `realtime.send` on topic `meeting:<id>`.
- Views: `race_result_rows`; `public_*` views with explicit column lists and no PII;
  `cutoff_inputs` and `admin_scoring_drift` for admins. RLS on every table; anon can read views
  only; pgTAP asserts no `public_*` view exposes service numbers, birth years, organiser
  contacts, key hashes or payloads.
- Engine: `qualification_meeting_cpp`, `qualification_rounds`, `qualification_round_sources`,
  `qualification_candidates`, `qualification_round_teams`, `qualification_overrides`,
  `army_qualifiers_list` (+ public view without service numbers), `army_initial_seed_list`,
  `aasl_rounds`, `aasl_round_sources`, `aasl_round_rows`, `aasl_overrides`, `engine_parameters`.
  Functions: `cpp_calculate/record/authorise`, `qualification_create_round`,
  `qualification_run_round`, `qualification_publish_round`,
  `qualification_produce_initial_seed_list`, `army_initial_seed_allot`,
  `army_meeting_seed_download`, `arrival_seed_candidates`, `arrival_seed_suggestion`,
  `aasl_run_round`, `aasl_publish_round`, `aasl_download`.

The qualification algorithm (thirteen steps) and its ambiguity register (29 items, each with a
default and an override) are recorded in the design notes and must be copied into
`supabase/README.md` in task T4.2 so the Chairman's screens can cite them.

## Task breakdown

Every task is one feature branch off `development`, one PR into `development`, tests in the
same PR, CI green before merge. IDs are used for dependencies. Sizes: S under a day, M one to
three days, L up to a week.

### Phase 0: foundations

| ID | Branch | Task | Size | Depends on |
|---|---|---|---|---|
| T0.1 | `chore/development-branch-and-ci` | Create `development` from `master`. Add `.github/workflows/ci.yml` running `npm test` (Node 22 so the node:sqlite suites run), `npm run typecheck`, and eslint on changed files, on PRs and pushes to `development` and `master`. Fix `devEngines` to Node 22. | S | none |
| T0.2 | `chore/workspaces-scoring-package` | npm workspaces; `packages/scoring` with helpers moved verbatim (`raceResults.js`, `MathFx.js`, `TimeUtils.js`, `calculateCategory` family, `calculateCPP`/`applyCPPToSeedList`, `RACE_FACTORS`); renderer files become re-exports; move `raceResults.test.js` and `cpp.test.js` to Vitest; root jest, tsconfig and eslint excludes; CI job. App behaviour unchanged. | M | T0.1 |
| T0.3 | `feat/schema-migration-runner` | `src/main/utils/migrations.js` with `user_version`, migration v1 (moved column list, FK repair without nested transactions, drop the AASL FK); `DatabaseWrapper` calls `applyMigrations`; tests: fresh DB, legacy DB upgrade with data intact, re-run no-op, failed migration rolls back, newer-than-app version refuses. Update `operations.test.js` and `seedList.test.js` to build via `createSchema`. | M | T0.1 |
| T0.4 | local | `codegraph init -i` (not a PR). | S | T0.1 |

### Phase 1: the app publishes (Epic A)

| ID | Branch | Task | Size | Depends on |
|---|---|---|---|---|
| T1.1 | `feat/competition-metadata` | Migration v2. Operations `competitions.create/update`. `createCompetitionNew.js` gains level, season (default from today's date), dates, venue. New `CompetitionSettingsPage` (Details tab) at `/competition/:id/settings`, linked from the competition page with level and season badges. Tests for both operations. | M | T0.3 |
| T1.2 | `feat/sync-outbox` | Migration v3. `src/main/operations/events.js` with `ENTITY_LOADERS`, `emitEntity`, `emitDelete`. Switch `results.*` and `startList.*` to entity emits (add emits to `saveRunDetails`, `setRunComplete` run and result rows, `regenerate`, `saveBibOrder`). `packages/sync-contract` with types, zod schemas and `batch.v1.json`. Tests: every operation's events equal the rows read back. | M | T1.1, T0.2 |
| T1.3 | `feat/sync-worker` | `src/main/sync/`: `settings.js` (installation id, per-competition key with `safeStorage`), `client.js` (`net.fetch`, timeout, non-JSON 2xx treated as offline), `outbox.js`, `worker.js` (debounced trigger after each operation commit, 15 s tick, backoff, 401/403/409 stop, 413 halve, 429 wait, per-event dead-letter), `ipc.js`, preload bridge `window.sync`, `sync.snapshotCompetition` (full snapshot, parent-first, supersedes pending upserts, ends with `snapshot_marker`), restore detection. Tests against a scripted fake fetch for every response class. | L | T1.2 |
| T1.4 | `feat/sync-ui` | Publishing tab on the settings page (API key, server URL, Test connection showing the server's meeting, sync enabled with "Publish everything" prompt, status card, Sync now, Retry failed). `SyncStatusIndicator` in `SidebarNew.js`. `SyncLogPage` with filter, payload viewer, retry and discard. `useSyncStatus` hook. | M | T1.3 |
| T1.5 | `feat/race-operations` | Operations `races.create/update/delete/setStatus/postDsqNotice`; officials resolved to display strings in `race` and `race_run` events; race pages (`CreateRacePageNew`, `EditRacePageNew`, `RaceDetailsPageNew`) migrated off raw SQL; "Mark official" and "Post DSQ notice" actions on the results page, enabled only when every run is locked. Tests. | M | T1.2 |
| T1.6 | `feat/competitor-operations` | Operations `competitors.upsert/importBatch/updateEntry/remove` emitting `competitor` and `meeting_entry`; register, edit, bulk edit, view and upload pages migrated; checkboxes for "does not wish to be considered for Army qualification" (B17.a) and "do not publish". Tests. | L | T1.2 |
| T1.7 | `feat/snapshots-and-finalise` | `packages/scoring` phase 2: `buildSeedList` (pure core of `FetchSeedList.js`), `buildIndividualStandings` (from `individualNew.js`), `buildTeamStandings` (best-three race points per team race summed, teams missing a race listed separately; `pages/results/teamNew.js` is rewritten on top of it and its seconds-based logic removed). Operation `snapshots.publish` storing and emitting `race_scores`, `seed_list_snapshot` (after N championship races) and `standings_snapshot` (individual and team), invoked from the results page when the final run is locked; "Publish seed list" button on `GenerateSeedListNew.js`. Operation `seedList.finalise` writing CPP and the final list atomically and emitting `cpp` + `final_seed_list`. Tests with the existing four-race scenario. | L | T1.2, T1.5 |
| T1.8 | `feat/team-operations` | Operations `teams.create/update/delete/addMember/removeMember` emitting `team` and `team_members`; team pages and `RaceTeamManagementNew` migrated (fixes the NULL-key inserts); `people.update`, `people.changeId`, and `people.merge` end with a competition snapshot. Tests. | M | T1.6 |
| T1.9 | `chore/retire-raw-sql-writes` | Remove `db-insert`, `db-delete`, `db-transaction` from `main.ts` and `preload.ts` (keep `db-select`); migration dropping `result_events`. | S | T1.5, T1.6, T1.8 |

### Phase 2: Supabase backend (Epics B and C, server side)

| ID | Branch | Task | Size | Depends on |
|---|---|---|---|---|
| T2.1 | `feat/supabase-foundation` | Two Supabase projects (staging for `development`, production for `master`, London region). `supabase init`, `config.toml` (signup off, functions without JWT verification), migrations 0001 to 0003 including the engine's base additions (`qualifies_for_aasl`, arrival seed source columns, `is_final`, races completed and awarded counts, `meeting_team_rosters` view). `seed.sql` with a demo published meeting. pgTAP 003 (no PII in views, unpublished invisible, withheld rows anonymised) and 004 (RLS). CI `supabase` job (`supabase test db`, `supabase db lint`). | L | T0.1 |
| T2.2 | `feat/supabase-ingest-core` | Migration 0004: `sync_events`, entity appliers, `apply_sync_events`, `touch_api_key`, race status triggers and history, `sync_broadcast`. pgTAP 001 (idempotent replay, one bad event rejected while the rest apply, deletes, collection replace, `accepted_up_to`) and 002 (status transitions) using `batch.v1.json`. | L | T2.1, T1.2 |
| T2.3 | `feat/supabase-views-rls` | Migration 0005 (`race_result_rows`, all `public_*` views, `cutoff_inputs`, `admin_scoring_drift`), 0006 (RLS, grants, realtime and storage policies, admin RPCs: create meeting, publish, issue and revoke key, set race status, post DSQ notice, register document), 0007 (pg_cron purges). pgTAP 005 golden scoring fixture shared with the Jest node:sqlite test. | M | T2.2 |
| T2.4 | `feat/edge-functions-ingest-ping` | `supabase/functions/ingest` and `ping` with shared auth (SHA-256 key lookup, rate limit) and http helpers; Deno tests for 401, 403, 409, 413, 429 and the happy path. `.github/workflows/deploy.yml`: push to `development` deploys migrations and functions to staging, push to `master` to production. First end-to-end run: the Electron worker against local Supabase. | M | T2.3, T1.3 |
| T2.5 | `feat/edge-function-query` | `supabase/functions/query` for the app's pull-downs, authenticated by the meeting key and scoped to that meeting's ladder: `lookup_competitor` (AASL points, feeder final seed points, CPP, races completed for the last three seasons), `list_meetings`, `final_seed_list`, `army_initial_seed_list`, `aasl`. Tests. | M | T2.3 |

### Phase 3: public site and admin area (Epic B, user side)

| ID | Branch | Task | Size | Depends on |
|---|---|---|---|---|
| T3.1 | `feat/web-scaffold-and-race-page` | `apps/web`: Vite, React, TS strict, Tailwind preset, shadcn copy, Supabase client, generated types, TanStack Query, `PublicShell` with bottom tabs. Routes `/`, `/m/:slug`, `/m/:slug/races/:raceId` (Annex E header, status badge, protest countdown, run tabs, finished table, DNS/DNF/DSQ per run, podiums, team results tab), `/m/:slug/races/:raceId/start-list`. Realtime channel per meeting plus polling fallback; `Freshness` component (times as of, received at, organiser online, updates waiting). Vitest for `StatusBadge`, `Freshness`, table partitioning. Cloudflare Pages deploy (staging from `development`, production from `master`). | L | T2.3 |
| T3.2 | `feat/web-standings-seed-search` | `/m/:slug/standings` (overall and category tabs), `/m/:slug/teams`, `/m/:slug/seed-list` (snapshot selector, penalty markers, CPP and final list), `/m/:slug/competitors/:entryId`, `/m/:slug/search`. Playwright smoke against `seed.sql`. | M | T3.1, T1.7 |
| T3.3 | `feat/web-admin` | `/admin`: magic-link login, `RequireAdmin`, meetings list, new meeting (chairman), meeting detail tabs: details and publish switch, API keys (show once, rotate, revoke), installations, races (post DSQ notice, mark official, revert), ingest log with rejections, cut-off tab placeholder. | L | T3.1, T2.3 |
| T3.4 | `feat/web-documents` | Storage bucket `meeting-documents` with policies, admin upload, `documents` registration, PDF links on race and seed list pages. | S | T3.3 |

### Phase 4: cross-championship seeding and the cut-off (Epics C and D)

| ID | Branch | Task | Size | Depends on |
|---|---|---|---|---|
| T4.1 | `feat/arrival-seed-pulldowns` | Electron: registration page "Central record" card on service-number blur with prefill of the arrival seed; `ImportArrivalSeedsPage` (choose a feeder meeting's final list or the Army Initial Seed List, preview matched and unmatched, apply through `competitors.applyArrivalSeeds` with overwrite off by default); AASL download on `ImportAASLPage` writing the `YYYY-YY` season format. `FetchSeedList.initialPoints` takes the competition level: at army level `arrival_army_seed` then `aasl_points` only, with entries lacking both flagged as missing points on the seeding race start list (`startOrder.js`) instead of defaulting to 2000; other levels unchanged. Cases in `seedList.test.js` and `startOrder.test.js`; update the seeding-rules memory note. | L | T2.5, T1.6 |
| T4.2 | `feat/qualification-schema` | Engine migration: enums, season helpers, all engine tables, RLS (chairman and alpine secretary; meeting secretaries read their own downloads), `engine_parameters`, `supabase/README.md` with the algorithm and the ambiguity register. | M | T2.3 |
| T4.3 | `feat/cpp-in-postgres` | `cpp_calculate`, `cpp_record`, `cpp_authorise` (PM, mode, manual override with reason). pgTAP reproducing the Appendix 2 worked example (CPP 38.26) and every case in `cpp.test.js`, with a comment linking the two. | M | T4.2 |
| T4.4 | `feat/qualification-run-round` | `qualification_create_round`, `qualification_run_round` (source resolution, CPP and PM, duplicates across meetings, eligibility B9.c, opt-outs, ranking by gender with ties, HC pass, team pass with fourth member, confirmed-round diff, run summary). pgTAP fixture with two qualifying meetings, teams, opt-outs, an ineligible competitor, HC entries and a boundary tie, expectations computed by hand. | L | T4.3 |
| T4.5 | `feat/qualification-publish-overrides` | Override RPCs (admit, exclude, eligibility, points, HC, fourth member, restrict team, set team) with reasons and revocation; `qualification_publish_round`; `army_qualifiers_list` and its public view; `qualification-notify` function on publish. pgTAP for overrides and re-runs. | M | T4.4 |
| T4.6 | `feat/army-initial-seed-list` | `qualification_produce_initial_seed_list`, `army_initial_seed_allot`, `army_meeting_seed_download` (feeds T4.1), `qualifiers-export` function (CSV for organisers, PDF without service numbers). pgTAP. | M | T4.5 |
| T4.7 | `feat/web-qualification-screens` | Admin cut-off screens: dashboard per Army meeting, CPP authorisation, run round with parameters, candidate review table with filters and flags (including the awarded-points marker), overrides modal, teams panel, publish with diff, Army Initial Seed List with allotment and exports. | L | T4.6, T3.3 |
| T4.8 | `feat/arrival-seed-suggestion` | `arrival_seed_candidates` and `arrival_seed_suggestion` applying the B3 precedence and the over-three-years penalty; `query` function exposes them; the T4.1 card shows the candidates and the suggestion with a reason field. pgTAP. | M | T4.3, T4.1 |

### Phase 5: AASL production (Epic E, later)

| ID | Branch | Task | Size | Depends on |
|---|---|---|---|---|
| T5.1 | `feat/aasl-rounds` | `aasl_create_round`, `aasl_run_round` (army-first source policy, 15% non-racer penalty, removal after two idle seasons or over 500 points), `aasl_publish_round`, `aasl_download`; admin screen; the app's spreadsheet import kept as a fallback. pgTAP with add, update, carry-penalised and remove cases. | L | T4.6 |

### Milestones

| Milestone | Tasks | What works |
|---|---|---|
| M1 Live results online | T0.1 to T0.3, T1.1 to T1.4, T2.1 to T2.4, T3.1 | One meeting's races, start lists and live and provisional results on phones; sync status in the app |
| M2 Official results and standings | T1.5 to T1.7, T2.5, T3.2, T3.3 | Official marking, standings, seed lists, competitor pages, admin area with keys and publishing |
| M3 Cross-championship | T1.8, T1.9, T4.1 to T4.8 | Arrival seeding from feeder meetings, Army Qualifiers Lists and Army Initial Seed List produced centrally and imported by the app |
| M4 AASL | T5.1, T3.4 | AASL generated and downloaded; documents online |

## Open decisions (still to settle; none blocks Phase 0 to 2)

1. **Penalty multiple interpretation** (Appendix 1 para 6): default treats PM as a scale on the
   CPP addend (adjusted = seed + CPP × PM); a per-meeting mode scales the whole list instead.
   Confirm with the AWSA Alpine Secretary before T4.3.
2. **One-run versus two-run team results** (`openTeamsOnly` inconsistency in
   `queries/RaceResults.js`): pick one before team results go public in T3.1. Recommendation:
   exclude corps and women's teams from the open team table in both, list them separately.
3. **Data protection sign-off**: names, rank and unit of serving personnel will be published;
   service numbers and birth years will be stored in Supabase (London region). This needs the
   AWSA's agreement and a short data-protection note before M1 goes to a real meeting.
4. **XLSki mandate** (Rule 3.a): raise with the AWSA; no software task.

## Verification

- Unit and integration: `npm test` (Electron, Node 22, node:sqlite suites), `npm -w
  packages/scoring test`, `npm -w apps/web test`, `npx supabase test db` (pgTAP), `deno test`
  for functions, Playwright smoke against `vite preview` with `seed.sql`. All run in CI on every
  PR into `development`.
- End-to-end for M1: start local Supabase (`npx supabase start`, `db reset`, `functions serve`),
  run the app (`npm start`), paste a key issued by `admin_issue_api_key`, enable sync, record
  results on a demo race, open the local web app and watch rows appear; disconnect the network,
  record more, reconnect, confirm the pending count drains and no duplicates; lock both runs
  and confirm `provisional`; mark official and confirm the badge and PDF link; toggle
  "do not publish" on an entry and confirm the name is withheld but the position kept.
- End-to-end for M3: two demo qualifying meetings feeding a demo Army meeting; finalise both
  seed lists in the app; in the admin area authorise CPP, run the provisional and confirmed
  rounds, compare the candidate table with the hand-computed pgTAP fixture, publish, and import
  the Army Initial Seed List into an army-level competition in the app; confirm the seeding race
  start list uses those points.
- Supabase advisors (via the connected MCP) reviewed after T2.3 and T4.2 for security and
  performance findings; the deliberate `security_definer_view` warnings on `public_*` are
  documented.

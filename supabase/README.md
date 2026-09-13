# Supabase backend

The central results service: a private Postgres mirror of every meeting,
public views for the results site (later migration), the ingest functions
and the qualification engine. See `docs/ONLINE_RESULTS_PLAN.md`.

## Projects

| Environment | Branch        | Project ref            | Region           |
|-------------|---------------|------------------------|------------------|
| staging     | `development` | `mfpkugemliabunkkyvvj` | London (eu-west-2) |
| production  | `master`      | not yet created        | London           |

Both live in the Slate Data organisation. The free plan allows two active
projects, so production needs a free slot (or the plan upgraded) before it
is created.

## Local development

Docker (OrbStack here) and the CLI from `devDependencies`:

```bash
npx supabase start          # first run pulls the images
npx supabase db reset       # re-apply every migration and seed.sql
npx supabase test db        # pgTAP suites in tests/
npx supabase db lint --level warning
npx supabase stop
```

`seed.sql` creates one published demo meeting for tests and the site. It is
never applied to a hosted project.

## Edge functions

- `POST /functions/v1/ping`, header `x-api-key`: checks the key, records the
  installation and returns the meeting the key is bound to, the supported
  contract versions and the batch limits. The app's "Test connection".
- `POST /functions/v1/ingest`, header `x-api-key`: one batch of outbox
  events (see `packages/sync-contract`). Returns `accepted_up_to_event_id`,
  `applied`, `duplicates`, `rejected[]` and `server_time`.

Error codes the worker acts on: 401 (missing, unknown or revoked key), 403
(`meeting_mismatch`, or an installation bound to another meeting), 409
(`schema_version_unsupported`, with `supported`), 413 (`body_too_large` or
`too_many_events`), 429 (`rate_limited`, with `retry_after_seconds`), 500
(`retryable: true`, the batch rolled back).

Local run: `npx supabase functions serve --no-verify-jwt`, then

```bash
curl -s -X POST http://127.0.0.1:54321/functions/v1/ping \
  -H 'x-api-key: awsa_demomeet_localdevelopmentkey000000000000'
```

That key is seeded for local development only. Unit tests for the pure
envelope checks: `deno test supabase/functions/tests` (CI installs Deno).
Deployment to a hosted project: `supabase functions deploy ingest ping
--no-verify-jwt` via `.github/workflows/deploy.yml` once the repository has
`SUPABASE_ACCESS_TOKEN`; until then, through the Supabase tools.

## Migrations

Files in `migrations/` are named `<version>_<name>.sql` where the version
is the timestamp the service recorded when the migration was applied to
staging. Until a CLI access token is configured for `supabase link` and
`db push`, migrations are applied to staging through the Supabase tools and
the local file is named after the recorded version so the two histories
match. Keep every migration additive and idempotent where possible; never
edit an applied migration, add a new one.

## Realtime

`apply_sync_events()` broadcasts one message per batch on the private topic
`meeting:<id>` through `realtime.send()`, and a policy on `realtime.messages`
lets anyone listen to a published meeting's topic. A freshly created hosted
project has neither the function nor the table until its Realtime service has
initialised, so the policy migration creates the policy only when the table
exists and the broadcast swallows failures. If the policy is missing on a
project, re-run that statement once Realtime is up. The public site never
depends on broadcasts: it polls as well.

## Security advisor notes

Two findings are by design and stay:

- `security_definer_view` on every `public_*` view: they are the public
  surface, owned by `postgres`, with explicit column lists, over base tables
  that the public roles cannot read at all. Organiser views
  (`admin_scoring_drift`, `cutoff_inputs`) run as the caller;
  `race_result_rows` runs as its owner, because a nested invoker view is
  checked against the querying role, and filters itself to published
  meetings or the caller's own.
- `authenticated_security_definer_function_executable` on the `admin_*`
  RPCs: every one checks the caller's role itself before doing anything.

## Access model

- Row level security is on for every table; `anon` and `authenticated`
  hold no table grants apart from the reference data (`seasons`,
  `race_factors`) and a signed-in user's own rows in `admin_users` and
  `meeting_admins`.
- The public site reads `public_*` views only (T2.3); they never expose
  service numbers, birth years, organiser contacts or key hashes.
- The desktop app authenticates to the ingest function with a per-meeting
  API key (stored as a SHA-256 hash); the key can never publish a meeting.
- Organisers sign in with magic links; sign-up is disabled, so users are
  invited from the dashboard.

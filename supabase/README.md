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

## Migrations

Files in `migrations/` are named `<version>_<name>.sql` where the version
is the timestamp the service recorded when the migration was applied to
staging. Until a CLI access token is configured for `supabase link` and
`db push`, migrations are applied to staging through the Supabase tools and
the local file is named after the recorded version so the two histories
match. Keep every migration additive and idempotent where possible; never
edit an applied migration, add a new one.

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

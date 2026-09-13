-- Nightly housekeeping. Event payloads hold private data, so applied events
-- are dropped after 180 days and rejected ones after a year; rate-limit
-- windows are dropped after a day.
create extension if not exists pg_cron;

create function purge_sync_housekeeping() returns void
language sql security definer set search_path = public as $$
  delete from sync_events where status = 'applied' and received_at < now() - interval '180 days';
  delete from sync_events where status = 'rejected' and received_at < now() - interval '365 days';
  delete from api_key_usage where window_start < now() - interval '1 day';
$$;
revoke execute on function purge_sync_housekeeping() from public, anon, authenticated;

select cron.schedule('purge-sync-housekeeping', '17 3 * * *', $$select public.purge_sync_housekeeping()$$);

-- Pin the search path of the array helper (security advisor).
create or replace function sync_uuid_array(p jsonb) returns uuid[]
language sql immutable set search_path = public as $$
  select coalesce(array(select (x)::uuid from jsonb_array_elements_text(coalesce(p, '[]'::jsonb)) x), '{}'::uuid[])
$$;

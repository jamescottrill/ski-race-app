-- Hardening from the security advisor: pin the search path of every
-- function, and run the role helpers as the caller rather than as their
-- owner. Policies evaluate them under the signed-in role, which can read its
-- own admin rows through the two self-read policies below, so nothing needs
-- security definer.

create or replace function set_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function has_role(p_roles admin_role[]) returns boolean
language sql stable security invoker set search_path = public as $$
  select exists (
    select 1 from admin_users where user_id = auth.uid() and role = any (p_roles)
  )
$$;
create or replace function is_chairman() returns boolean
language sql stable security invoker set search_path = public as $$
  select has_role(array['chairman']::admin_role[])
$$;
create or replace function is_meeting_admin(p_meeting uuid) returns boolean
language sql stable security invoker set search_path = public as $$
  select is_chairman() or exists (
    select 1 from meeting_admins where meeting_id = p_meeting and user_id = auth.uid()
  )
$$;

grant select on admin_users, meeting_admins to authenticated;
create policy admin_users_self_read on admin_users
  for select to authenticated using (user_id = auth.uid());
create policy meeting_admins_self_read on meeting_admins
  for select to authenticated using (user_id = auth.uid());

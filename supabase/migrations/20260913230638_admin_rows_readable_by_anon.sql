-- The role helpers run as the caller and read admin_users and
-- meeting_admins; anon now calls them through race_result_rows. With the
-- same self-read policy, an anonymous session (no user id) sees no rows.
grant select on admin_users, meeting_admins to anon;
create policy admin_users_self_read_anon on admin_users
  for select to anon using (user_id = auth.uid());
create policy meeting_admins_self_read_anon on meeting_admins
  for select to anon using (user_id = auth.uid());

-- Function privileges are checked against the calling role even inside a
-- view that runs as its owner, and race_result_rows now calls
-- is_meeting_admin() for its visibility filter. The helpers return false
-- without a signed-in user, so anon may execute them.
grant execute on function has_role(admin_role[]), is_chairman(), is_meeting_admin(uuid) to anon;

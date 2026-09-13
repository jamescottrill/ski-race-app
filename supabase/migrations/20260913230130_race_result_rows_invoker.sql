-- race_result_rows is an organiser view, so it must run as the caller and
-- let row level security apply. The public_* views that build on it keep
-- running as their owner, which is what nesting resolves to.
alter view race_result_rows set (security_invoker = true);

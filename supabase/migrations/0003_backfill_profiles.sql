-- Backfill profile rows for accounts created BEFORE 0001_init.sql added the
-- on_auth_user_created trigger. Without this, existing users (including yours)
-- have no profile row, so the consent gates never trigger and the free-use
-- counter has nowhere to live.
--
-- Safe to re-run.
insert into public.profiles (id, email)
select u.id, u.email
  from auth.users u
 on conflict (id) do nothing;

-- Confirm: every auth user should now have exactly one profile.
select
  (select count(*) from auth.users)    as auth_users,
  (select count(*) from public.profiles) as profiles;

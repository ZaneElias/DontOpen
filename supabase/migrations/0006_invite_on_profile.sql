-- Track invite redemption on the profile, not just at signup.
--
-- Email signup collects a code in the form, but Google OAuth skips that form
-- entirely — so a Google user could create an account with no code at all,
-- which defeats the closed-beta gate. Recording redemption here lets the app
-- gate AFTER authentication, whichever way the user signed in.
alter table public.profiles
  add column if not exists invite_code_redeemed_at timestamptz;

-- Redeem a code for the CURRENT user and stamp their profile in one step.
-- Security-definer so it can touch invite_codes (which has no select policy)
-- while still only ever writing the caller's own profile row.
create or replace function public.redeem_invite_for_me(p_code text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  remaining integer;
  uid uuid := auth.uid();
begin
  if uid is null then
    return false;                       -- must be signed in
  end if;

  -- Already redeemed: succeed idempotently rather than burning another code.
  if exists (select 1 from public.profiles where id = uid and invite_code_redeemed_at is not null) then
    return true;
  end if;

  update public.invite_codes
     set uses_remaining = uses_remaining - 1
   where code = p_code and uses_remaining > 0
   returning uses_remaining into remaining;

  if remaining is null then
    return false;                       -- unknown or exhausted code
  end if;

  update public.profiles
     set invite_code_redeemed_at = now()
   where id = uid;

  return true;
end;
$$;

-- Existing accounts (created before invite gating) are grandfathered in, so
-- you aren't locked out of your own app.
update public.profiles
   set invite_code_redeemed_at = now()
 where invite_code_redeemed_at is null;

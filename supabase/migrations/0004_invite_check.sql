-- Non-consuming invite-code validator.
--
-- Signup is: check -> create account -> redeem. Without this peek, a code would
-- be burned even when the signup itself fails (weak password, duplicate email),
-- which for a hand-issued beta code is unrecoverable without minting a new one.
--
-- Still security-definer and returns only a boolean, so the codes table stays
-- unreadable with the anon key.
create or replace function public.check_invite_code(p_code text)
returns boolean
language plpgsql
security definer set search_path = public
stable
as $$
begin
  return exists (
    select 1 from public.invite_codes
     where code = p_code and uses_remaining > 0
  );
end;
$$;

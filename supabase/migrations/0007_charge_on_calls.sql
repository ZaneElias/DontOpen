-- Charge a free use when work actually starts, not when a job is created.
--
-- Creating a job costs nothing to run: switching verticals, refreshing, or
-- abandoning a half-filled brief all created jobs, and each one burned a use.
-- The use is now spent at the first call-placing action and recorded per JOB,
-- so negotiation, the report, and any retry on that same job ride on it.
--
-- The "already charged" flag deliberately does NOT live on public.jobs: users
-- can update their own job rows, so a flag there could be flipped with the anon
-- key for unlimited free uses. This table has a SELECT policy and nothing else,
-- so only the security-definer function below can write it.

create table if not exists public.job_charges (
  job_id     text primary key references public.jobs(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  charged_at timestamptz not null default now()
);
create index if not exists job_charges_user_idx on public.job_charges (user_id, charged_at desc);

alter table public.job_charges enable row level security;

drop policy if exists "job_charges: read own" on public.job_charges;
create policy "job_charges: read own" on public.job_charges
  for select using (auth.uid() = user_id);
-- (no insert/update/delete policy: RLS denies those to every user session)


create or replace function public.consume_free_use_for_job(p_job_id text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  uid       uuid := auth.uid();
  owner     uuid;
  remaining integer;
begin
  if uid is null then
    return false;
  end if;

  select user_id into owner from public.jobs where id = p_job_id;
  if owner is null or owner <> uid then
    return false;                      -- unknown job, or not this caller's
  end if;

  -- Claim first, charge second. The primary key makes the claim atomic, so two
  -- concurrent "start calls" clicks can't both decrement.
  insert into public.job_charges (job_id, user_id)
  values (p_job_id, uid)
  on conflict (job_id) do nothing;

  if not found then
    return true;                       -- already paid for: proceed free
  end if;

  update public.profiles
     set free_uses_remaining = free_uses_remaining - 1
   where id = uid and free_uses_remaining > 0
   returning free_uses_remaining into remaining;

  if remaining is null then
    -- Out of uses: release the claim so a later top-up can still run this job.
    delete from public.job_charges where job_id = p_job_id;
    return false;
  end if;

  return true;
end;
$$;

-- CallPilot schema: per-user job data, consent gates, usage limits, invite codes.
-- Run in the Supabase SQL editor. Safe to re-run (idempotent).
--
-- Security model: the anon key is public, so EVERY table below has Row Level
-- Security enabled and policies scoped to auth.uid(). RLS is the only thing
-- standing between a user and someone else's data.

-- ── profiles ─────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id                        uuid primary key references auth.users(id) on delete cascade,
  email                     text,
  privacy_accepted_at       timestamptz,
  beta_consent_accepted_at  timestamptz,
  free_uses_remaining       integer not null default 4,
  created_at                timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);

-- Users may update consent timestamps, but must NOT be able to hand themselves
-- more free uses. free_uses_remaining is decremented server-side only.
drop policy if exists "profiles: update own consent" on public.profiles;
create policy "profiles: update own consent" on public.profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and free_uses_remaining = (select p.free_uses_remaining from public.profiles p where p.id = auth.uid())
  );

-- Auto-create a profile row whenever a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── jobs ───────────────────────────────────────────────────────────────
-- id stays TEXT to preserve the existing job_xxxx identifiers used in agent
-- webhook URLs and dynamic variables.
create table if not exists public.jobs (
  id             text primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  vertical       text not null default 'moving',
  fields         jsonb not null default '{}'::jsonb,
  field_sources  jsonb not null default '{}'::jsonb,
  needs_review   jsonb not null default '[]'::jsonb,
  confirmed      boolean not null default false,
  confirmed_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists jobs_user_id_idx on public.jobs (user_id, created_at desc);

alter table public.jobs enable row level security;
drop policy if exists "jobs: own rows" on public.jobs;
create policy "jobs: own rows" on public.jobs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── calls ────────────────────────────────────────────────────────────
-- The CallRecord/Quote pydantic models stay the source of truth for shape, so
-- the row keeps the serialized model in `payload` alongside indexed columns.
create table if not exists public.calls (
  id          text primary key,
  job_id      text not null references public.jobs(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  status      text,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists calls_job_id_idx on public.calls (job_id);

alter table public.calls enable row level security;
drop policy if exists "calls: own rows" on public.calls;
create policy "calls: own rows" on public.calls
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── quotes ───────────────────────────────────────────────────────────
create table if not exists public.quotes (
  id            text primary key,
  job_id        text not null references public.jobs(id) on delete cascade,
  call_id       text,
  user_id       uuid not null references auth.users(id) on delete cascade,
  company_name  text,
  total_price   numeric,
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists quotes_job_id_idx on public.quotes (job_id);

alter table public.quotes enable row level security;
drop policy if exists "quotes: own rows" on public.quotes;
create policy "quotes: own rows" on public.quotes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── negotiations ──────────────────────────────────────────────────────
create table if not exists public.negotiations (
  id                 text primary key,
  job_id             text not null references public.jobs(id) on delete cascade,
  user_id            uuid not null references auth.users(id) on delete cascade,
  quote_id           text,
  leverage_quote_id  text,
  before_total       numeric,
  after_total        numeric,
  payload            jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);
create index if not exists negotiations_job_id_idx on public.negotiations (job_id);

alter table public.negotiations enable row level security;
drop policy if exists "negotiations: own rows" on public.negotiations;
create policy "negotiations: own rows" on public.negotiations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── invite codes (closed beta gating) ─────────────────────────────────────
create table if not exists public.invite_codes (
  code            text primary key,
  uses_remaining  integer not null default 1,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

-- Deliberately NO select policy: nobody may list or read codes with the anon
-- key, or the gate is trivially bypassed. Redemption goes through the
-- security-definer function below, which is the only way to touch this table.
alter table public.invite_codes enable row level security;

create or replace function public.redeem_invite_code(p_code text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  remaining integer;
begin
  update public.invite_codes
     set uses_remaining = uses_remaining - 1
   where code = p_code and uses_remaining > 0
   returning uses_remaining into remaining;
  return remaining is not null;
end;
$$;

-- ── usage limit (Part 4) ───────────────────────────────────────────────
-- Atomic decrement so two concurrent job creations can't both slip through on
-- the last remaining use. Returns false when the user is out of free uses.
create or replace function public.consume_free_use()
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  remaining integer;
begin
  update public.profiles
     set free_uses_remaining = free_uses_remaining - 1
   where id = auth.uid() and free_uses_remaining > 0
   returning free_uses_remaining into remaining;
  return remaining is not null;
end;
$$;

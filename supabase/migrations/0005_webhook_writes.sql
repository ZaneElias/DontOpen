-- Webhook write path (telephony mode).
--
-- Agent webhooks arrive with no user session at all, so they cannot satisfy the
-- RLS policies that require auth.uid() = user_id. These security-definer
-- functions resolve the owner FROM THE JOB itself and write on their behalf,
-- so a webhook can only ever write into a job that already exists and only
-- under that job's real owner.
--
-- SECURITY NOTE: with the public anon key, knowing a job_id is enough to call
-- these. That is already true of the existing webhook URLs (the job id is the
-- only thing guarding /calls/{job_id}/{call_id}/webhook), so this adds no new
-- exposure - but before running real telephony you should add a shared webhook
-- secret rather than relying on a 10-character id.

create or replace function public.webhook_record_call(
  p_job_id  text,
  p_call_id text,
  p_status  text,
  p_payload jsonb
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  owner uuid;
begin
  select user_id into owner from public.jobs where id = p_job_id;
  if owner is null then
    return false;                      -- unknown job: write nothing
  end if;

  insert into public.calls (id, job_id, user_id, status, payload)
  values (p_call_id, p_job_id, owner, p_status, p_payload)
  on conflict (id) do update
    set status     = excluded.status,
        payload    = excluded.payload,
        updated_at = now();
  return true;
end;
$$;

create or replace function public.webhook_record_quote(
  p_job_id   text,
  p_quote_id text,
  p_call_id  text,
  p_company  text,
  p_total    numeric,
  p_payload  jsonb
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  owner uuid;
begin
  select user_id into owner from public.jobs where id = p_job_id;
  if owner is null then
    return false;
  end if;

  insert into public.quotes (id, job_id, call_id, user_id, company_name, total_price, payload)
  values (p_quote_id, p_job_id, p_call_id, owner, p_company, p_total, p_payload)
  on conflict (id) do update
    set company_name = excluded.company_name,
        total_price  = excluded.total_price,
        payload      = excluded.payload,
        updated_at   = now();
  return true;
end;
$$;

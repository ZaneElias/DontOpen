"""
User-scoped Supabase persistence for job data.

Design: every read/write goes through a PostgREST client bound to the CALLER'S
own JWT, so Row Level Security enforces ownership inside Postgres. The backend
deliberately holds no service-role key — there is no credential here that could
bypass RLS even by mistake, and application code is never the thing standing
between one user's data and another's.

JobSpec/CallRecord/Quote pydantic models remain the source of truth for shape;
rows keep the serialized model in a jsonb `payload` alongside indexed columns.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional

from supabase import Client, create_client

from schema import CallRecord, JobSpec, Quote

logger = logging.getLogger("callpilot.store")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")


def store_configured() -> bool:
    return bool(SUPABASE_URL and SUPABASE_ANON_KEY)


def client_for(access_token: str) -> Client:
    """A Supabase client acting AS the signed-in user (RLS applies to it)."""
    if not store_configured():
        raise RuntimeError("Supabase store is not configured (SUPABASE_URL / SUPABASE_ANON_KEY)")
    client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    client.postgrest.auth(access_token)
    return client


# ── mapping ──────────────────────────────────────────────────────────

def _job_to_row(job: JobSpec, user_id: str) -> Dict[str, Any]:
    return {
        "id": job.job_id,
        "user_id": user_id,
        "vertical": job.vertical,
        "fields": job.fields,
        "field_sources": {k: (v.value if hasattr(v, "value") else v) for k, v in job.field_sources.items()},
        "needs_review": job.needs_review,
        "confirmed": job.confirmed,
        "confirmed_at": job.confirmed_at.isoformat() if job.confirmed_at else None,
        "updated_at": job.updated_at.isoformat(),
    }


def _row_to_job(row: Dict[str, Any]) -> JobSpec:
    return JobSpec(
        job_id=row["id"],
        vertical=row.get("vertical") or "moving",
        fields=row.get("fields") or {},
        field_sources=row.get("field_sources") or {},
        needs_review=row.get("needs_review") or [],
        confirmed=bool(row.get("confirmed")),
        confirmed_at=row.get("confirmed_at"),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )


# ── jobs ────────────────────────────────────────────────────────────

def save_job(access_token: str, user_id: str, job: JobSpec) -> None:
    client_for(access_token).table("jobs").upsert(_job_to_row(job, user_id)).execute()


def get_job(access_token: str, job_id: str) -> Optional[JobSpec]:
    """Returns the job only if RLS says the caller owns it, else None."""
    res = client_for(access_token).table("jobs").select("*").eq("id", job_id).limit(1).execute()
    rows = res.data or []
    return _row_to_job(rows[0]) if rows else None


def list_jobs(access_token: str) -> List[JobSpec]:
    res = client_for(access_token).table("jobs").select("*").order("created_at", desc=True).execute()
    return [_row_to_job(r) for r in (res.data or [])]


# ── calls / quotes ────────────────────────────────────────────────────

def save_call(access_token: str, user_id: str, call: CallRecord) -> None:
    client_for(access_token).table("calls").upsert({
        "id": call.call_id,
        "job_id": call.job_id,
        "user_id": user_id,
        "status": call.status.value if hasattr(call.status, "value") else str(call.status),
        "payload": call.model_dump(mode="json"),
    }).execute()


def list_calls(access_token: str, job_id: str) -> List[CallRecord]:
    res = client_for(access_token).table("calls").select("payload").eq("job_id", job_id).execute()
    return [CallRecord(**r["payload"]) for r in (res.data or []) if r.get("payload")]


def save_quote(access_token: str, user_id: str, quote: Quote) -> None:
    client_for(access_token).table("quotes").upsert({
        "id": quote.quote_id,
        "job_id": quote.job_id,
        "call_id": quote.call_id,
        "user_id": user_id,
        "company_name": quote.company_name,
        "total_price": quote.total_price,
        "payload": quote.model_dump(mode="json"),
    }).execute()


def list_quotes(access_token: str, job_id: str) -> List[Quote]:
    res = client_for(access_token).table("quotes").select("payload").eq("job_id", job_id).execute()
    return [Quote(**r["payload"]) for r in (res.data or []) if r.get("payload")]


# ── usage limit (Part 4) ───────────────────────────────────────────────

def consume_free_use(access_token: str) -> bool:
    """Atomically spend one free use. False when the user has none left."""
    res = client_for(access_token).rpc("consume_free_use", {}).execute()
    return bool(res.data)


def get_profile(access_token: str) -> Optional[Dict[str, Any]]:
    res = client_for(access_token).table("profiles").select("*").limit(1).execute()
    rows = res.data or []
    return rows[0] if rows else None

"""
Location sanity-checking.

Every other field in a job spec is either bounded by an enum, a number range,
or a date — a location is the one required field that is pure free text, so
"fddh" sails through and the agent ends up asking businesses to quote a move to
a place that doesn't exist.

This resolves a location string against OpenStreetMap's Nominatim geocoder,
which needs no API key. Design constraints:

  * **Advisory, never blocking.** A definitive "no such place" becomes a
    needs_review flag the user sees on the brief; it does not stop them. A
    geocoder is not the authority on whether someone's address is real — new
    developments, rural addresses, and unusual spellings all miss — and hard
    -blocking on a false negative would be a much worse failure than letting a
    typo through.
  * **Fails open.** Timeout, rate-limit, or outage returns "unknown", never
    "invalid". The geocoder being down must not make jobs unconfirmable.
  * **Cached.** Same string is only ever looked up once per process, which
    keeps us well inside Nominatim's 1 req/sec community usage policy.
"""

from __future__ import annotations

import logging
import os
import threading
import time
from typing import Dict, Optional, Tuple

import httpx

logger = logging.getLogger("callpilot.location")

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

# Nominatim's usage policy requires a real identifying User-Agent.
_CONTACT = os.environ.get("GEOCODER_CONTACT", "support@callpilot.app")
_USER_AGENT = f"CallPilot/1.0 (job-spec location validation; contact: {_CONTACT})"

_MIN_INTERVAL_S = 1.1          # community policy: at most 1 request per second
_TIMEOUT_S = 6.0               # a slow geocoder must not stall a confirm

_cache: Dict[str, Optional[str]] = {}   # query -> resolved display name, or None if not found
_lock = threading.Lock()
_last_call_at = 0.0


def geocoding_enabled() -> bool:
    """Off switch, so a deployment can disable the outbound lookup entirely."""
    return os.environ.get("DISABLE_GEOCODE_CHECK", "").strip().lower() not in ("1", "true", "yes")


def resolve(text: str) -> Tuple[str, Optional[str]]:
    """Resolve a location string.

    Returns (status, display_name) where status is one of:
      "valid"    - the geocoder matched a real place
      "unknown"  - could not determine (disabled, too short, network error)
      "not_found"- the geocoder ran and found nothing

    Only "not_found" is evidence of a bad value; "unknown" must be treated as
    no signal at all.
    """
    global _last_call_at

    query = (text or "").strip()
    if not geocoding_enabled() or len(query) < 2:
        return "unknown", None

    key = query.lower()
    with _lock:
        if key in _cache:
            hit = _cache[key]
            return ("valid", hit) if hit else ("not_found", None)

        # Serialise and space out requests inside the lock so concurrent
        # confirms can't burst past the geocoder's rate limit.
        wait = _MIN_INTERVAL_S - (time.monotonic() - _last_call_at)
        if wait > 0:
            time.sleep(wait)
        try:
            resp = httpx.get(
                NOMINATIM_URL,
                params={"q": query, "format": "json", "limit": 1, "addressdetails": 0},
                headers={"User-Agent": _USER_AGENT},
                timeout=_TIMEOUT_S,
            )
            _last_call_at = time.monotonic()
            if resp.status_code != 200:
                logger.info("geocoder returned %s for %r — treating as unknown", resp.status_code, query)
                return "unknown", None
            data = resp.json()
        except Exception as exc:                       # network, timeout, bad JSON
            logger.info("geocoder unavailable (%s) — treating as unknown", type(exc).__name__)
            return "unknown", None

        if data:
            display = data[0].get("display_name")
            _cache[key] = display
            return "valid", display
        _cache[key] = None
        return "not_found", None


def review_notes_for(fields: Dict[str, object], schema: Dict[str, dict]) -> list:
    """Return needs_review notes for any schema field marked `is_location: true`
    whose value the geocoder positively could not find.

    Config-driven on purpose: which fields are places is a property of the
    vertical, so a new vertical declares it in YAML rather than editing this
    module.
    """
    notes = []
    for name, spec in schema.items():
        if not spec.get("is_location"):
            continue
        value = fields.get(name)
        if not isinstance(value, str) or not value.strip():
            continue
        status, _ = resolve(value)
        if status == "not_found":
            label = name.replace("_", " ")
            notes.append(
                f"{label}: couldn't find \"{value.strip()[:60]}\" as a real place — "
                "businesses will be asked about it exactly as written."
            )
    return notes

"""
Place autocomplete.

Why this exists: validating a free-text address after the fact does not work.
OpenStreetMap contains millions of tiny hamlets, so keyboard-mashing resolves to
a *real place* about half the time — "sfsf" is a village in Algeria, "asdf" a
hamlet in Germany. No threshold fixes that; the question "does this name exist
somewhere on Earth" is simply the wrong one.

So instead of detecting bad input, this removes the ability to enter it: the
user picks from resolved suggestions rather than typing free text.

Provider is Photon (photon.komoot.io) — OSM-based, built for typeahead, no API
key, ~210ms. One important detail, found by testing rather than by reading the
docs: Photon's own `layer` filter does NOT restrict results to settlements. It
happily returns businesses ("SFS Fahrsport", a bar called "Querty"). Filtering
on `osm_key == "place"` here is what actually works — with it, every gibberish
string tested returns zero suggestions.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List

import httpx

logger = logging.getLogger("callpilot.places")

PHOTON_URL = os.environ.get("PHOTON_URL", "https://photon.komoot.io/api/")
_USER_AGENT = "CallPilot/1.0 (place autocomplete)"
_TIMEOUT_S = 6.0

# Settlement-ish values only. Excludes osm_value like "house"/"farm", which are
# real places but far too granular to hand a business as a service area.
_ACCEPTED_VALUES = {
    "city", "town", "village", "hamlet", "suburb", "neighbourhood",
    "borough", "quarter", "municipality", "county", "state", "region",
    "province", "district", "island", "locality", "city_block", "postcode",
}

_cache: Dict[str, List[Dict[str, Any]]] = {}


def _plausible_match(query: str, name: str) -> bool:
    """Photon matches fuzzily, so "asdf" surfaces Alagün and "qwerty" surfaces
    Quercy — real places that share almost nothing with what was typed. Require
    the first three characters to actually line up.

    Skipped when either side is non-Latin: "Tokyo" legitimately returns 東京都,
    and a character comparison there would reject a correct answer.
    """
    q, n = query.strip().lower(), name.strip().lower()
    if not q.isascii() or not n.isascii():
        return True
    return n.startswith(q[:3]) or q in n


def suggest(query: str, limit: int = 6) -> List[Dict[str, Any]]:
    """Resolved place suggestions for a partial query. [] when nothing matches.

    Never raises: a geocoder outage returns no suggestions, and the caller
    decides what that means. It must not be able to break typing.
    """
    q = (query or "").strip()
    if len(q) < 2:
        return []

    key = f"{q.lower()}|{limit}"
    if key in _cache:
        return _cache[key]

    try:
        resp = httpx.get(
            PHOTON_URL,
            # Over-fetch: most raw hits are businesses that the filter below
            # discards, so asking for exactly `limit` would under-fill.
            params={"q": q, "limit": max(limit * 3, 15)},
            headers={"User-Agent": _USER_AGENT},
            timeout=_TIMEOUT_S,
        )
        if resp.status_code != 200:
            logger.info("photon returned %s for %r", resp.status_code, q)
            return []
        features = resp.json().get("features", []) or []
    except Exception as exc:
        logger.info("photon unavailable (%s)", type(exc).__name__)
        return []

    out: List[Dict[str, Any]] = []
    seen = set()
    for f in features:
        p = f.get("properties", {}) or {}
        if p.get("osm_key") != "place":
            continue
        if p.get("osm_value") not in _ACCEPTED_VALUES:
            continue
        name = p.get("name")
        if not name or not _plausible_match(q, name):
            continue
        # "Charlotte, North Carolina, United States" — enough context to tell
        # the three Charlottes apart, which is the whole point of picking.
        parts = [name]
        for k in ("state", "country"):
            v = p.get(k)
            if v and v not in parts:
                parts.append(v)
        label = ", ".join(parts)
        if label in seen:
            continue
        seen.add(label)
        out.append({
            "label": label,
            "name": name,
            "state": p.get("state"),
            "country": p.get("country"),
            "type": p.get("osm_value"),
        })
        if len(out) >= limit:
            break

    _cache[key] = out
    return out

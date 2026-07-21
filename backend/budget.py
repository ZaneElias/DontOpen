"""
Global monthly spend ceiling for the closed beta.

The point is to fail *loudly and early* rather than discover the overspend on a
provider invoice. Usage is estimated from what the app itself does — agent
simulations, TTS synthesis, report generation, telephony minutes — because the
provider APIs don't expose real-time spend cheaply enough to check per request.

Estimates are deliberately conservative (they over-count rather than under-count)
so the cap trips before the real bill does.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict

logger = logging.getLogger("callpilot.budget")

MONTHLY_BUDGET_USD = float(os.environ.get("MONTHLY_BUDGET_USD", "0") or 0)

# Conservative per-unit estimates in USD.
COST_PER_SIMULATED_CALL = 0.25   # ElevenLabs conversational turns for one agent-to-agent call
COST_PER_TELEPHONY_MIN = 0.18    # Twilio + ElevenLabs voice, per minute
COST_PER_REPORT = 0.05           # OpenAI report generation
COST_PER_TTS_REPLAY = 0.03       # TTS synthesis of a transcript

_STATE_DIR = Path(__file__).resolve().parent / ".state"
_LEDGER = _STATE_DIR / "spend.json"


def _period() -> str:
    now = datetime.now(timezone.utc)
    return f"{now.year:04d}-{now.month:02d}"


def _load() -> Dict[str, float]:
    try:
        data = json.loads(_LEDGER.read_text(encoding="utf-8"))
        return {str(k): float(v) for k, v in data.items()}
    except Exception:
        return {}


def _save(ledger: Dict[str, float]) -> None:
    try:
        _STATE_DIR.mkdir(exist_ok=True)
        _LEDGER.write_text(json.dumps(ledger), encoding="utf-8")
    except Exception:
        logger.warning("could not write spend ledger", exc_info=True)


def record(amount_usd: float) -> None:
    """Add estimated spend to the current month."""
    if amount_usd <= 0:
        return
    ledger = _load()
    period = _period()
    ledger[period] = round(ledger.get(period, 0.0) + amount_usd, 4)
    _save(ledger)


def spent_this_month() -> float:
    return _load().get(_period(), 0.0)


def enabled() -> bool:
    return MONTHLY_BUDGET_USD > 0


def exhausted() -> bool:
    """True when the ceiling is set and has been reached."""
    return enabled() and spent_this_month() >= MONTHLY_BUDGET_USD


def status() -> Dict[str, object]:
    spent = spent_this_month()
    return {
        "enabled": enabled(),
        "budget_usd": MONTHLY_BUDGET_USD,
        "spent_usd": round(spent, 2),
        "remaining_usd": round(max(MONTHLY_BUDGET_USD - spent, 0.0), 2) if enabled() else None,
        "exhausted": exhausted(),
        "period": _period(),
    }

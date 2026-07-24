#!/usr/bin/env python3
"""
Golden-call eval harness.

Replays saved reference calls through the REAL extraction and red-flag code and
scores the output against expectations. The two questions it answers are the two
the product is judged on:

  * does the agent extract every fee?
  * does it catch the 30%-below-market red flag?

Deliberately imports the production functions rather than reimplementing them.
A harness with its own copy of the logic passes while production breaks, which
is worse than no harness at all.

No network and no API keys: each case carries a captured simulation payload in
the shape ElevenLabs returns, so this runs in CI.

Usage:
    cd backend && python ../evals/run_evals.py [--verbose] [--case ID] [--json]
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

CASES_DIR = Path(__file__).parent / "cases"
BACKEND_DIR = Path(__file__).parent.parent / "backend"

# Import the backend package. Run from anywhere; we anchor on this file.
sys.path.insert(0, str(BACKEND_DIR))

# Config lookups read the vertical YAMLs by relative path, so anchor the cwd to
# backend/ regardless of where the harness was invoked from.
os.chdir(BACKEND_DIR)

import config  # noqa: E402
import main  # noqa: E402
from schema import CallRecord, JobSpec, Quote  # noqa: E402
from services import elevenlabs_client  # noqa: E402


GREEN, RED, YELLOW, DIM, RESET = "\033[32m", "\033[31m", "\033[33m", "\033[2m", "\033[0m"
if os.environ.get("NO_COLOR") or not sys.stdout.isatty():
    GREEN = RED = YELLOW = DIM = RESET = ""


def load_cases(only: str | None) -> List[Dict[str, Any]]:
    cases = []
    for path in sorted(CASES_DIR.glob("*.json")):
        case = json.loads(path.read_text(encoding="utf-8"))
        case["_file"] = path.name
        if only and case.get("id") != only:
            continue
        cases.append(case)
    return cases


def run_case(case: Dict[str, Any]) -> Tuple[List[str], List[str]]:
    """Replay one case. Returns (failures, notes)."""
    failures: List[str] = []
    notes: List[str] = []
    expect = case.get("expect", {})

    # ── Stage 1: transcript → logged quote (real parser) ──────────────────
    # A dict stands in for the SDK object; parse_simulation_result reads both
    # through its _attr helper, which is the same path production takes.
    turns, logged = elevenlabs_client.parse_simulation_result(case["simulation_response"])

    if logged is None:
        failures.append("no log_quote tool call was parsed from the transcript")
        return failures, notes
    notes.append(f"{len(turns)} turns parsed")

    # ── Stage 2: logged quote → structured fields (real extractors) ───────
    line_items = main._line_items_from_params(logged)
    total = main._total_from_params(logged, line_items)
    outcome = main._outcome_from_params(logged)

    got_labels = [li.label for li in line_items]
    if "line_item_labels" in expect:
        want = expect["line_item_labels"]
        # Order-insensitive: the agent may log fees in any order, but a missing
        # fee and an invented one are both failures — each means the customer
        # compares a number that doesn't match what was said on the call.
        missing = [x for x in want if x not in got_labels]
        extra = [x for x in got_labels if x not in want]
        if missing:
            failures.append(f"missing fee(s): {missing}")
        if extra:
            failures.append(f"unexpected fee(s): {extra}")

    if "total_price" in expect:
        want_total = expect["total_price"]
        if want_total is None:
            if total is not None:
                failures.append(f"expected no total, got {total}")
        elif total is None:
            failures.append(f"expected total {want_total}, got none")
        elif abs(total - want_total) > 0.01:
            failures.append(f"total {total} != expected {want_total}")

    if "outcome" in expect and outcome.value != expect["outcome"]:
        failures.append(f"outcome '{outcome.value}' != expected '{expect['outcome']}'")

    binding = bool(logged.get("binding", False))
    if "binding" in expect and binding != expect["binding"]:
        failures.append(f"binding {binding} != expected {expect['binding']}")

    # ── Stage 3: quote + job → red flags (real rule engine) ───────────────
    job = JobSpec(vertical=case["vertical"], fields=dict(case.get("job_fields", {})))
    quote = Quote(
        job_id=job.job_id,
        call_id="call_eval",
        company_name=logged.get("company_name") or "Unknown",
        phone_number="+15555550100",
        base_price=logged.get("base_price"),
        line_items=line_items,
        total_price=total,
        outcome=outcome,
        binding=binding,
        negotiation_notes=logged.get("notes"),
    )
    vconfig = config.load_vertical_config(case["vertical"])
    flags = main._apply_red_flags(job, [quote], vconfig)
    blob = " ".join(flags).lower()

    for needle in expect.get("red_flags_contain", []):
        if needle.lower() not in blob:
            failures.append(f"expected a red flag mentioning '{needle}' — flags were {flags or 'none'}")
    for needle in expect.get("red_flags_absent", []):
        if needle.lower() in blob:
            failures.append(f"unexpected red flag mentioning '{needle}': {flags}")

    if "is_red_flag" in expect and bool(quote.is_red_flag) != expect["is_red_flag"]:
        failures.append(f"is_red_flag {quote.is_red_flag} != expected {expect['is_red_flag']}")

    if flags:
        notes.append(f"{len(flags)} flag(s)")
    return failures, notes


def main_cli() -> int:
    ap = argparse.ArgumentParser(description="Replay golden calls through the real extraction pipeline.")
    ap.add_argument("--verbose", "-v", action="store_true", help="show per-case detail")
    ap.add_argument("--case", help="run a single case by id")
    ap.add_argument("--json", action="store_true", dest="as_json", help="machine-readable summary")
    args = ap.parse_args()

    cases = load_cases(args.case)
    if not cases:
        print(f"No cases found{' matching ' + args.case if args.case else ''} in {CASES_DIR}", file=sys.stderr)
        return 2

    results = []
    passed = 0
    for case in cases:
        try:
            failures, notes = run_case(case)
        except Exception as exc:  # a crash is a failure, not a stack trace
            failures, notes = [f"harness error: {type(exc).__name__}: {exc}"], []
        ok = not failures
        passed += ok
        results.append({"id": case["id"], "vertical": case["vertical"], "passed": ok, "failures": failures})

        if args.as_json:
            continue
        mark = f"{GREEN}PASS{RESET}" if ok else f"{RED}FAIL{RESET}"
        detail = f"  {DIM}{', '.join(notes)}{RESET}" if notes and args.verbose else ""
        print(f"  {mark}  {case['id']:<34} {DIM}{case['vertical']}{RESET}{detail}")
        if args.verbose and ok:
            print(f"        {DIM}{case.get('description','')}{RESET}")
        for f in failures:
            print(f"        {RED}→ {f}{RESET}")

    total = len(cases)
    if args.as_json:
        print(json.dumps({"total": total, "passed": passed, "failed": total - passed, "results": results}, indent=2))
    else:
        bar = GREEN if passed == total else RED
        print(f"\n  {bar}{passed}/{total} cases passed{RESET}")
        if passed != total:
            print(f"  {YELLOW}Re-run with --verbose for detail.{RESET}")
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main_cli())

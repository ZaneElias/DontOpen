# CallPilot evals

Scored regression tests for the two judgement calls the product actually makes:

1. **Does the agent extract every fee?** A quote that misses the stairs charge
   isn't a cheaper quote — it's a wrong one, and it corrupts the ranking that
   the whole report rests on.
2. **Does it catch the 30%-below-market red flag?** A lowball that reads as the
   best deal is the single most expensive failure this product can have.

## What these actually run

The cases replay through the **real** production functions — no reimplemented
logic, no mocks:

| Stage | Function under test |
|---|---|
| transcript → logged quote | `elevenlabs_client.parse_simulation_result` |
| logged quote → line items | `main._line_items_from_params` |
| logged quote → total | `main._total_from_params` |
| logged quote → outcome | `main._outcome_from_params` |
| quote + job → red flags | `main._apply_red_flags` |

That matters: a test that reimplements extraction would pass while production
broke. These import the same code the deployed app runs, so if the pipeline
regresses, the evals fail.

No API keys, no network. Each case carries a captured simulation payload in the
same shape ElevenLabs returns, so the suite runs in CI.

## Running

```bash
cd backend && python ../evals/run_evals.py
```

Exit code is non-zero if any case fails, so CI catches regressions.

Useful flags:

```bash
python ../evals/run_evals.py --verbose        # per-assertion detail
python ../evals/run_evals.py --case moving_lowball_below_market
python ../evals/run_evals.py --json           # machine-readable summary
```

## Case format

One JSON file per case in `cases/`. The `expect` block is the scored part:

```jsonc
{
  "id": "moving_tough_all_fees",
  "vertical": "moving",
  "job_fields": { "bedrooms": 2, "stairs_origin": 2 },
  "simulation_response": { "simulated_conversation": [ /* turns + tool_calls */ ] },
  "expect": {
    "line_item_labels": ["Base", "Stairs"],   // every fee, order-insensitive
    "total_price": 1850.0,
    "outcome": "quote_given",
    "red_flags_contain": ["below"],           // substring, case-insensitive
    "red_flags_absent": ["stairs"]
  }
}
```

`line_item_labels` is the fee-extraction score: a missing label and an
invented one both fail, because both mean the customer is comparing numbers
that don't reflect what was said on the call.

## Adding a case from a real call

The cases here were built by hand against the personas in `backend/configs/`.
To capture a genuine one instead:

1. Run a simulation, then `GET /api/calls/{job_id}` and copy the transcript.
2. Save it in the `simulated_conversation` shape above, with the Caller's
   `log_quote` tool call attached to the turn where it fired.
3. Write the `expect` block from what the transcript *actually says* — not from
   what the code currently outputs. A case that encodes current behaviour can
   only ever confirm the bug.

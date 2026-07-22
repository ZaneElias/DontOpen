# Enabling telephony

How to switch CallPilot from agent-to-agent simulation to placing **real phone
calls to real businesses**, what changes when you do, and what to settle first.

---

## What telephony actually changes

The target list does **not** change. The same businesses you simulate against are
the ones that get dialled. Switching modes changes *how* the conversation
happens, not *who* it's with or what's said.

| | Simulation | Telephony |
|---|---|---|
| Conversation | Agent ↔ agent | Agent ↔ **a real person** |
| Tavily businesses | Negotiated with by name | **Actually dialled** |
| Audio | AI-voiced transcript replay | **Real call recording** |
| Cost per call | ~$0.25 | Twilio minutes + ElevenLabs voice |
| Duration | 30–60s | Real-time, plus no-answers and voicemail |
| Failure modes | API errors | No-answer, IVR menus, hang-ups, wrong numbers |

---

## Prerequisites

### 1. A paid Twilio account — this is the real blocker

**Twilio trial accounts do not work.** Verified on two of them: every call shows
`completed` in Twilio at ~13–14 seconds, while ElevenLabs reports `initiated`
with **0 conversation turns**. The trial's "press any key to continue" preamble
never bridges media, so the agent never hears anything and never speaks.

There is no code fix for this. Upgrade off trial.

### 2. A phone number registered in ElevenLabs

Already done — `ELEVENLABS_CALLER_PHONE_NUMBER_ID` is set. Confirm with:

```bash
curl -s https://<your-render-url>/health
```

You should already see:

```json
"telephony_ready": true,
"telephony": { "required": false, "missing": [] }
```

If `telephony_ready` is true, the only thing standing between you and live calls
is the mode switch.

---

## Switching it on

### Step 1 — flip the mode

Render → your backend service → **Environment**:

```
CALL_MODE = telephony
```

Anything unrecognised falls back to `simulation`, so a typo can't accidentally
start spending money.

### Step 2 — (recommended) enable live quote capture

```
WEBHOOK_BASE_URL = https://<your-render-url>
```

Without it calls still work — quotes are read from the polled transcript after
the call instead of being pushed live by the agent's `log_quote` tool. With it,
quotes appear as they're stated.

### Step 3 — run the webhook migration

```
supabase/migrations/0005_webhook_writes.sql
```

Agent webhooks arrive with **no user session**, so they can't satisfy the RLS
policies directly. This adds security-definer functions that resolve the owner
*from the job itself*, so a webhook can only ever write into a job that already
exists, under its real owner.

**Until this runs, webhook-written quotes silently fail to persist.**

### Step 4 — (optional) demo personas over real phone lines

Only if you want the three scripted personas reachable by phone:

```
COUNTERPARTY_TOUGH_NUMBER
COUNTERPARTY_STONEWALL_NUMBER
COUNTERPARTY_HARDSELL_NUMBER
```

Not needed for real businesses — Tavily supplies those numbers.

### Step 5 — verify

```bash
curl -s https://<your-render-url>/health
```

Expect `"call_mode": "telephony"` and `"missing_required_count": 0`.

---

## Before your first live run

### Check the budget cap is actually armed

```json
"budget": { "enabled": true, "budget_usd": 25 }
```

Telephony is metered at an estimated `$0.18/minute` on top of per-call costs.
Estimates are deliberately conservative so the cap trips *before* the real
invoice does. If `enabled` is `false`, `MONTHLY_BUDGET_USD` isn't set and
**nothing is stopping spend**.

### Do one controlled call first

Pick a single business you're comfortable calling — ideally your own second
phone. Confirm end to end: the call connects, the agent speaks, a quote is
captured, the recording plays back, and the row lands in Supabase. Only then run
a full three-way comparison.

### Settle the recording question

This is the one item worth resolving *before* flipping the switch, not after.

Every call is **recorded and transcribed**, including the voice of a business
employee who is not your user and never agreed to your terms. The agent
announces that it is an AI calling on behalf of a customer — **that is not the
same as consent to be recorded.**

Some jurisdictions require the explicit consent of *all* parties before a call
may be recorded (California and several other US states). Your privacy policy
describes what the product does, but it does not resolve whether your recording
practice is lawful in the states you'll be calling into.

Get a lawyer's read on this specific point before placing real calls at any
scale. It is a genuine legal question, not a formatting one.

### Expect messier failures

Simulation fails cleanly via API errors. Real calls fail as no-answers,
voicemail, IVR menus, receptionists refusing to quote by phone, and hang-ups.
These are handled as structured outcomes, but they are untested against real
lines — budget time for surprises on your first runs.

---

## Switching back

```
CALL_MODE = simulation
```

Restart. No data migration, no cleanup. Jobs and quotes already gathered stay
exactly as they are.

---

## Recommendation

**Keep a public beta on simulation.**

Simulation already demonstrates the entire product — real businesses sourced
live, negotiated with by name, genuine unscripted agent conversations, real
transcripts, real price movement, and a fully evidenced report — at near-zero
cost, with no legal exposure and nobody's phone ringing.

Turn telephony on deliberately: a small, controlled run, once the consent
question is answered and the budget cap is confirmed live.

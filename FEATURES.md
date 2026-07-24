# CallPilot — Features

Voice agents that call the market, extract itemized quotes, and negotiate with real
leverage. Built for the ElevenLabs × Hack-Nation "The Negotiator" challenge.

---

## The problem

The same 45-mile move gets quoted anywhere from **$1,158 to $6,506** — a **5.6×
spread** for identical work. The spread exists because every quote is gathered
differently: you describe the job slightly differently each call, forget a
detail, or get a number that quietly excludes stairs and long carry.

CallPilot removes that variable. One confirmed job spec is read **verbatim** to
every business, so the quotes that come back are actually comparable.

---

## The four stages

### 1. Brief — build one job spec

Three ways in, all producing the same structured spec:

- **Voice interview** — an ElevenLabs agent talks you through the job and logs
  each field as it's confirmed.
- **Document / photo upload** — an OpenAI vision model reads an existing quote or
  inventory list and extracts structured fields.
- **Manual form** — rendered from the vertical's schema, always available.

Every field carries a **provenance badge** ("from voice", "from document", "you
  entered") so you can see where each value came from and correct it. Nothing is
used until you confirm; once confirmed the spec is frozen for that job.

Move dates are constrained to today or later, computed in your own timezone.

### 2. Calls — gather comparable quotes

Runs **at least three counterparties** in parallel, each with a distinct
negotiating posture:

| Style | Behaviour |
|---|---|
| Tough negotiator | Quotes high, concedes only against real competing numbers |
| Stonewaller | Won't quote without seeing the job; must be worked past it |
| Hard-sell upseller | Quotes low to hook, then piles on fees and add-ons |

Two sources of counterparty:

- **Demo personas** — scripted stand-ins with invented company names.
- **Real businesses** — sourced live from the web via Tavily, with real phone
  numbers. In simulation the agent negotiates with each one **by name**; in
  telephony mode the same list is dialled for real.

Each call ends in exactly one structured outcome: quote given, callback
promised, declined, no prices over phone, hang-up, or unreachable.

### 3. Negotiate — leverage, not bluffing

Calls back the other businesses citing **your actual best competing quote**.
Never an invented number, never a fabricated competitor. The UI shows the
leverage being used live ("citing Summit's $1,260 vs their $1,570") and the
report records the before/after movement per company.

### 4. Report — ranked, evidenced, explained

- Ranked comparison with market spread (low / median / high)
- **Red-flag detection** — below-market pricing with the exact % below benchmark,
  non-binding quotes, cash-only or large-deposit demands
- Flagged quotes rank **below** clean ones: a suspiciously cheap flagged quote is
  the least trustworthy option, not the best buy
- **Evidence linking** — click any price to see the transcript turn where it was
  stated. Nothing appears in the report without a line behind it
- Plain-language recommendation, and a spoken version of it
- Save as PDF

---

## Config-driven verticals

Three ship today — **Moving**, **Auto Repair**, and **Home Contractors** —
defined entirely in `backend/configs/*.yaml`. Each config declares its own field
schema, price benchmarks, red-flag rules, negotiation levers, and counterparty
personas. The third was added with zero changes to `main.py` or `schema.py` — a
YAML file plus three persona prompts — which is the config-driven claim shown
rather than asserted.

**Adding a vertical is a file, not code.** Drop in a YAML and it appears in the
market picker, the intake form regenerates itself from the schema, the red-flag
rules apply, and the same generic Caller agent handles it — no agent rewrite, no
frontend change.

---

## Two call modes

| | Simulation (default) | Telephony |
|---|---|---|
| Conversation | Agent ↔ agent, genuinely unscripted | Agent ↔ real person |
| Real businesses | Negotiated with **by name** | **Actually dialled** |
| Audio | AI-voiced replay of the transcript | Real call recording |
| Cost | ~$0.25/call | Twilio minutes + voice |
| Requires | ElevenLabs + OpenAI | Twilio (paid), phone number id |

Both run the **same Caller agent** against the **same job spec**. Switching modes
changes how a call is placed, not who is contacted or what is said. See
[TELEPHONY.md](./TELEPHONY.md).

---

## Audio

- **Transcript replay** — any call voiced with two distinct voices (agent vs
  counterparty) so it sounds like two people
- **Spoken recommendation** — the report summary read aloud
- Synthesis is cached per call and generated on first play, so credits are only
  spent on calls someone actually listens to
- Per-turn voice fallback: if one counterparty voice is unavailable on the
  account, that turn falls back to the agent voice rather than losing the whole
  replay

---

## Accounts, data and safety

### Authentication
- Supabase Auth — email/password and Google
- Tokens verified against the project's **JWKS endpoint** (ES256/RS256), keys
  cached. Forged tokens are rejected
- Every route touching job or quote data requires a valid token; agent webhooks
  are excluded by design (they're called by ElevenLabs, not a browser, and are
  already scoped to a job by path)
- Agent webhooks can additionally be HMAC-verified: set `WEBHOOK_SHARED_SECRET`
  and configure the agent to send an `x-callpilot-signature` header
  (HMAC-SHA256 of the body). Unset by default so simulation and existing
  deploys are unaffected; when set, unsigned or mis-signed webhooks get 401

### Data ownership
- `jobs`, `calls`, `quotes`, `negotiations`, `profiles` — every row owned by a
  `user_id`
- **Row Level Security on every table.** Ownership is decided by Postgres, not by
  application code
- **No service-role key exists anywhere in the backend.** There is no credential
  that can bypass RLS, even by mistake. The backend queries as the signed-in user
- `invite_codes` has RLS enabled and **no select policy** — codes can never be
  listed with the public anon key

### Consent gates
- **Privacy policy** — rendered from a single markdown source, acceptance stamped
  as `privacy_accepted_at`
- **Beta consent** — states plainly that this is early software, that calls are
  recorded and transcribed, and that nothing gathered is binding. Stamped as
  `beta_consent_accepted_at`
- Both block app access until accepted, and both offer a sign-out escape

### Limits
- **4 free comparisons per account**, spent when calls actually start — not when
  a job is created. Browsing verticals, refreshing, or abandoning a half-filled
  brief costs nothing; you're only charged once work runs
- Charged **per job**, recorded in Postgres, so negotiation, the report, and any
  re-run on that same job ride on the one use. The claim is a primary-key insert,
  so two concurrent "start calls" clicks can't both decrement
- The already-charged flag lives in its own table with **no insert/update/delete
  policy** — putting it on `jobs` (which users can update) would have let anyone
  grant themselves unlimited runs with the anon key
- Usage chip in the header warns before the limit, not at it
- **Monthly budget ceiling** (`MONTHLY_BUDGET_USD`) tracked against estimated
  spend. At the cap, new calls are blocked app-wide with a clear message rather
  than failing somewhere deeper
- **Invite codes** — optional by default so evaluators aren't locked out; set
  `NEXT_PUBLIC_REQUIRE_INVITE_CODE=true` to arm the closed beta. Codes are
  single-use, validated before account creation so a failed signup can't burn one

---

## Resilience

- **State survives restarts.** Jobs, calls and quotes persist to Postgres; the
  backend also snapshots in-memory state to disk. A redeploy no longer strands an
  in-flight job
- Long-running work (30–60s simulations) runs as background tasks and returns
  immediately; the UI polls for completion
- Failures are surfaced, not swallowed — a failed job creation shows an actual
  error with a retry instead of an endless skeleton
- `/health` reports config status, `auth_configured`, `store_configured`, budget
  state and `backend_build`, so a half-configured deploy is visible in one request

---

## Interface

Liquid-glass surfaces, a theme-aware animated background, 3D-tilt form card,
staggered entrance choreography, animated money counters, editorial typography
with serif accents. Full light/dark support, `prefers-reduced-motion` respected
throughout, and a persistent "Report an issue" link for beta feedback.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind v4, Framer Motion |
| Backend | FastAPI (Python) |
| Auth + data | Supabase (Postgres + RLS) |
| Voice | ElevenLabs Conversational AI + TTS |
| Reasoning | OpenAI (vision extraction, report generation) |
| Business sourcing | Tavily |
| Place lookup | OpenStreetMap (Photon autocomplete + Nominatim) |
| Telephony | Twilio (optional) |
| Hosting | Vercel (frontend) + Render (backend) |

---

## Quality

- **Golden-call evals** (`evals/`) — 12 saved reference calls replayed through
  the *real* extraction and red-flag code (not a reimplementation), scoring the
  two things the brief judges: does the agent extract every fee, and does it
  catch the 30%-below-market red flag. `python evals/run_evals.py`, non-zero exit
  on failure. Mutation-tested: breaking the scaling or the fee-summing makes the
  matching case fail
- **CI** (`.github/workflows/ci.yml`) — on every push and PR: backend imports,
  every vertical config validates, the eval suite runs, and the frontend
  typechecks and builds

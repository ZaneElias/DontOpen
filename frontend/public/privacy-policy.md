# Privacy Policy

**Effective date:** [DATE]
**Last updated:** [DATE]

[Company/Product Name] ("CallPilot," "we," "us," or "our") provides an AI voice-agent service that gathers price quotes and negotiates on your behalf by phone. This Privacy Policy explains what information we collect, how we use it, and the choices you have — including information about **third parties we call on your behalf**, who are also affected by this service even though they are not our users.

This policy applies to [our website at URL], our application, and related services (collectively, the "Service").

---

## 1. Information We Collect

### 1.1 Account information
When you create an account, we collect your email address and authentication credentials (via [Supabase Auth / your auth provider]). If you use single sign-on, we receive the basic profile information your provider shares with us.

### 1.2 Information about your move or job
To generate quotes, we collect the details you provide about your job — for moving, this includes origin and destination addresses, move date, inventory size, large or special items, and any notes you add. You provide this through:
- **A voice interview**, which is recorded and transcribed by our voice AI provider (see §3).
- **Uploaded documents or photos** (e.g. an existing quote, an inventory list), which are processed by an AI vision model to extract structured details.

You confirm this information before we use it, and it is reused verbatim across every call we place so quotes are comparable.

### 1.3 Call recordings and transcripts — including third parties
**This is the section that most distinguishes us from a typical app, and we want to be direct about it.** To gather and negotiate quotes, our AI agent places outbound phone calls to third-party businesses (e.g. moving companies) on your behalf. **These calls are recorded and transcribed.**

- **The agent discloses at the start of every call that it is an AI calling on behalf of a customer**, and identifies itself as such if asked directly.
- **[JURISDICTION-DEPENDENT — REQUIRES LEGAL REVIEW]:** Some jurisdictions require the explicit, affirmative consent of *all* parties to a call before it may be recorded ("two-party" or "all-party" consent states, e.g. California). Our current mechanism for obtaining and documenting that consent from the business representative on the other end of the call is: [DESCRIBE ACTUAL MECHANISM — e.g. "the agent verbally states the call is being recorded before proceeding" — and have counsel confirm this satisfies applicable law in every state your calls originate to or from].
- Call recordings and transcripts are stored and associated with your account so we can produce your comparison report and let you review the evidence behind it.
- The businesses you call are **not** our users and have not agreed to *our* Terms of Service. We are separately responsible for how we obtain, use, and disclose their voice/likeness data in a recording, which is a distinct legal question from how we treat your data as our user. [This requires its own legal analysis — do not assume this policy resolves it.]

### 1.4 Payment information
If you subscribe to a paid plan, payment is processed by [Stripe / payment processor]. We do not store your full card number; we retain only what's needed for billing history (e.g. plan tier, last 4 digits, transaction dates).

### 1.5 Usage and device information
We collect standard technical data — IP address, browser type, timestamps, and how many free uses your account has remaining — to operate, secure, and rate-limit the Service.

---

## 2. How We Use Information

We use the information above to:
- Build your job specification and confirm it with you before any calls are placed
- Place calls, gather quotes, and negotiate on your behalf
- Generate your ranked comparison report, including citing transcript evidence
- Operate your account, enforce usage limits, and process payment
- Improve the reliability of our AI agents (e.g. reviewing failed or problematic calls) — [DECIDE: do you use call data to train/fine-tune models? If yes, this needs explicit disclosure and likely a separate opt-in, not a buried clause.]
- Comply with legal obligations and enforce our Terms of Service

We do **not** sell your personal information.

---

## 3. Third Parties We Share Information With

We share information with the following service providers ("subprocessors") strictly to operate the Service:

| Provider | What it receives | Purpose |
|---|---|---|
| ElevenLabs | Voice interview audio, call audio/transcripts | Voice AI, call placement |
| OpenAI | Uploaded documents/photos, job details, transcript text | Document extraction, quote report generation |
| [Twilio / telephony provider] | Phone numbers, call audio | Placing outbound telephone calls |
| Supabase | Account and job data | Authentication, database storage |
| [Stripe] | Payment details | Billing |

[UPDATE THIS LIST to match whatever your actual infrastructure is at time of publishing — this table needs to stay accurate or it becomes misleading, which is its own legal problem.]

We do not permit these providers to use your data for their own purposes beyond providing the service to us, to the extent our agreements with them allow us to make that commitment. [Verify against each provider's actual DPA/terms before stating this.]

We may also disclose information if required by law, subpoena, or to protect the rights, property, or safety of CallPilot, our users, or others.

---

## 4. Data Retention

We retain job details, call recordings, and transcripts for [X days/months] after your report is generated, after which [they are deleted / anonymized — DECIDE THIS]. Account information is retained until you delete your account. [Some jurisdictions impose minimum or maximum retention requirements on call recordings specifically — confirm with counsel.]

---

## 5. Your Rights

Depending on where you live, you may have the right to:
- Access the personal information we hold about you
- Request correction or deletion of your information
- Export your data
- Withdraw consent where processing is based on consent
- Opt out of certain uses of your information

To exercise these rights, contact us at [email]. [If you have or expect California, EU, or other residents, add the specific CCPA/GDPR mechanics here — this generic section is not sufficient on its own for those jurisdictions.]

---

## 6. Children's Privacy

The Service is not directed to individuals under 18, and we do not knowingly collect personal information from children.

---

## 7. Security

We use reasonable technical and organizational measures to protect your information, including [encryption in transit / at rest, access controls — describe what you actually do]. No system is completely secure, and we cannot guarantee absolute security.

---

## 8. International Data Transfers

[Company Name] is based in [jurisdiction], and our service providers may process data in the United States and other countries. By using the Service, you acknowledge your information may be transferred to and processed in countries with different data protection laws than your own. [If you'll have EU users, this needs a real transfer-mechanism disclosure — SCCs, etc. Get counsel involved.]

---

## 9. Changes to This Policy

We may update this Privacy Policy from time to time. We will notify you of material changes by [email / in-app notice] before they take effect.

---

## 10. Contact Us

Questions about this policy: [email address]
[Company Name, Address — if you have a registered entity by publish time]

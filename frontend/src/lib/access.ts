/**
 * Whether an invite code is required to create an account.
 *
 * Defaults to NOT required, so anyone evaluating the product (judges,
 * reviewers) can sign up and use it immediately without knowing a code.
 * Set NEXT_PUBLIC_REQUIRE_INVITE_CODE="true" to re-arm the closed beta.
 *
 * Codes still work either way: if one is entered it's validated and redeemed,
 * so you keep per-tester attribution without locking evaluators out.
 */
export const REQUIRE_INVITE_CODE = process.env.NEXT_PUBLIC_REQUIRE_INVITE_CODE === "true";

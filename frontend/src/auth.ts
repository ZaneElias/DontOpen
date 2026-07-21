import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Auth.js (NextAuth v5) with Google sign-in.
 *
 * CallPilot has no database, so sessions are JWT-only — signing in gives you a
 * verified identity (name/email/avatar) for the session, nothing is persisted
 * server-side. Credentials are read from env: AUTH_GOOGLE_ID,
 * AUTH_GOOGLE_SECRET, AUTH_SECRET (see .env.local, gitignored).
 *
 * Google Cloud Console must list this redirect URI:
 *   http://localhost:3000/api/auth/callback/google
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  // Sign-in is optional in the demo, so send failures back to the entry screen
  // rather than a bare Auth.js error page.
  pages: { error: "/" },
});

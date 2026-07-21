"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Loader2, Mail, Lock, ArrowRight, Ticket } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { REQUIRE_INVITE_CODE } from "@/lib/access";

type Mode = "signin" | "signup";

/**
 * Real email/password auth against Supabase. Session state is owned by
 * AuthProvider, so the UI always reflects the actual session.
 */
export function AuthForm() {
  const { signIn, signUp, signInWithGoogle, configured } = useAuth();
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (mode === "signup" && REQUIRE_INVITE_CODE && !inviteCode.trim()) {
      setError("An invite code is required during the closed beta.");
      return;
    }
    setBusy(true);
    const result =
      mode === "signin" ? await signIn(email, password) : await signUp(email, password, inviteCode);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.needsEmailConfirmation) {
      setNotice("Check your email to confirm your account, then sign in.");
      setMode("signin");
    }
    // On success the AuthProvider session listener swaps the view automatically.
  }

  if (!configured) {
    return (
      <p className="max-w-xs text-center text-xs text-status-flag">
        Supabase isn&apos;t configured. Set NEXT_PUBLIC_SUPABASE_URL and
        NEXT_PUBLIC_SUPABASE_ANON_KEY, then reload.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-xs flex-col gap-3">
      <div className="cp-field flex flex-col justify-center gap-0.5 px-3.5 py-2.5">
        <span className="flex items-center gap-1.5 text-[0.67rem] font-medium tracking-[0.02em] text-ink-muted">
          <Mail className="size-3" /> Email
        </span>
        <input
          type="email"
          autoComplete="email"
          className="cp-control"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>

      <div className="cp-field flex flex-col justify-center gap-0.5 px-3.5 py-2.5">
        <span className="flex items-center gap-1.5 text-[0.67rem] font-medium tracking-[0.02em] text-ink-muted">
          <Lock className="size-3" /> Password
        </span>
        <input
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          className="cp-control"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === "signup" ? "at least 6 characters" : "••••••••"}
        />
      </div>

      {mode === "signup" ? (
        <div className="cp-field flex flex-col justify-center gap-0.5 px-3.5 py-2.5">
          <span className="flex items-center gap-1.5 text-[0.67rem] font-medium tracking-[0.02em] text-ink-muted">
            <Ticket className="size-3" /> Invite code {REQUIRE_INVITE_CODE ? "" : "(optional)"}
          </span>
          <input
            className="cp-control uppercase"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="CP-XXXX-XXXX"
            autoCapitalize="characters"
            spellCheck={false}
          />
        </div>
      ) : null}

      {error ? <p className="text-center text-[11px] text-status-flag">{error}</p> : null}
      {notice ? <p className="text-center text-[11px] text-status-done">{notice}</p> : null}

      <motion.button
        type="submit"
        disabled={busy}
        whileHover={reduce || busy ? undefined : { scale: 1.02 }}
        whileTap={reduce || busy ? undefined : { scale: 0.97 }}
        transition={{ type: "spring", stiffness: 400, damping: 22 }}
        className="group inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-action px-4 text-sm font-medium text-action-foreground shadow-lg shadow-action/25 disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
        {mode === "signin" ? "Sign in" : "Create account"}
        {!busy ? <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /> : null}
      </motion.button>

      <div className="flex items-center gap-3 py-0.5">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[10px] uppercase tracking-wider text-ink-muted">or</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <motion.button
        type="button"
        onClick={async () => {
          setError(null);
          const res = await signInWithGoogle();
          if (res.error) setError(res.error);
        }}
        whileHover={reduce ? undefined : { scale: 1.02 }}
        whileTap={reduce ? undefined : { scale: 0.97 }}
        transition={{ type: "spring", stiffness: 400, damping: 22 }}
        className="inline-flex h-11 cursor-pointer items-center justify-center gap-2.5 rounded-lg bg-white px-4 text-sm font-medium text-gray-900 shadow-lg"
      >
        <GoogleIcon />
        Continue with Google
      </motion.button>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError(null);
          setNotice(null);
        }}
        className="cursor-pointer text-center text-[11px] text-ink-muted underline-offset-4 hover:text-ink hover:underline"
      >
        {mode === "signin" ? "Have an invite code? Create an account" : "Already have an account? Sign in"}
      </button>

      {mode === "signup" ? (
        <p className="text-center text-[10px] leading-relaxed text-ink-muted">
          {REQUIRE_INVITE_CODE
            ? "CallPilot is in closed beta — accounts require an invite code."
            : "CallPilot is in beta. Every account includes four free comparisons."}
        </p>
      ) : null}
    </form>
  );
}

function GoogleIcon() {
  return (
    <svg className="size-4" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.389-7.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.389-7.917z" />
    </svg>
  );
}

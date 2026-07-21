"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Loader2, Mail, Lock, ArrowRight } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

type Mode = "signin" | "signup";

/**
 * Real email/password auth against Supabase. Session state is owned by
 * AuthProvider, so the UI always reflects the actual session.
 */
export function AuthForm() {
  const { signIn, signUp, configured } = useAuth();
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    setBusy(true);
    const result = mode === "signin" ? await signIn(email, password) : await signUp(email, password);
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

      <button
        type="button"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError(null);
          setNotice(null);
        }}
        className="cursor-pointer text-center text-[11px] text-ink-muted underline-offset-4 hover:text-ink hover:underline"
      >
        {mode === "signin" ? "No account? Create one" : "Already have an account? Sign in"}
      </button>
    </form>
  );
}

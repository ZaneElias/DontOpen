"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Loader2, Ticket, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";

/**
 * Collects an invite code from users who authenticated without going through
 * the email signup form — i.e. Google OAuth, which skips it entirely. Without
 * this, signing in with Google bypassed the closed-beta gate completely.
 */
export function InviteGate() {
  const { user, refreshProfile, signOut } = useAuth();
  const reduce = useReducedMotion();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError("Enter the invite code you were given.");
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("redeem_invite_for_me", { p_code: trimmed });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    if (!data) {
      setError("That code isn't valid or has already been used.");
      return;
    }
    await refreshProfile();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent p-4 text-ink">
      <motion.form
        onSubmit={submit}
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="liquid-glass backdrop-blur-xl w-full max-w-sm rounded-2xl p-7"
      >
        <span className="flex size-10 items-center justify-center rounded-xl bg-action/15">
          <Ticket className="size-5 text-action" />
        </span>
        <h1 className="cp-display mt-4 text-xl text-ink">You need an invite code</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          CallPilot is in closed beta. Enter the code you were given to finish setting up your account.
        </p>

        <div className="cp-field mt-5 flex flex-col justify-center gap-0.5 px-3.5 py-2.5">
          <span className="text-[0.67rem] font-medium tracking-[0.02em] text-ink-muted">Invite code</span>
          <input
            className="cp-control uppercase"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="CP-XXXX-XXXX"
            autoCapitalize="characters"
            spellCheck={false}
          />
        </div>

        {error ? <p className="mt-2 text-[11px] text-status-flag">{error}</p> : null}

        <button
          type="submit"
          disabled={busy}
          className="mt-4 inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-action text-sm font-medium text-action-foreground shadow-lg shadow-action/25 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Continue
        </button>

        <div className="mt-4 flex items-center justify-between text-[11px] text-ink-muted">
          <span className="truncate">{user?.email}</span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1 underline-offset-4 hover:text-ink hover:underline"
          >
            <LogOut className="size-3" /> Sign out
          </button>
        </div>
      </motion.form>
    </div>
  );
}

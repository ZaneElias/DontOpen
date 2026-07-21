"use client";

import { Sparkles, LogOut, MessageSquareWarning } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useAuth } from "@/components/auth-provider";

/**
 * Shown when an account has spent all of its free comparisons. Blocks new job
 * creation only — finished reports stay reachable.
 *
 * The upgrade block is a deliberate placeholder: there is no billing behind it.
 * It exists so the paywall has a real home in the UI when one is added.
 */
export function UsageExhausted() {
  const { user, signOut } = useAuth();
  const reduce = useReducedMotion();
  const feedback = process.env.NEXT_PUBLIC_FEEDBACK_URL;

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="liquid-glass backdrop-blur-xl w-full max-w-lg rounded-2xl p-8 text-center"
      >
        <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-action/15">
          <Sparkles className="size-5 text-action" />
        </span>

        <h1 className="cp-display mt-4 text-2xl text-ink">You&apos;ve used all your free comparisons</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          Every account gets four during the closed beta. Your finished reports are still here — this only stops new
          comparisons from starting.
        </p>

        {/* Placeholder slot for a future paywall — intentionally not wired up. */}
        <div className="mt-6 rounded-xl border border-dashed border-line-strong/70 px-5 py-4">
          <p className="text-sm font-medium text-ink">Need more?</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            Paid plans aren&apos;t available yet. If you&apos;ve run out and still need runs for testing, message us and
            we&apos;ll top your account up.
          </p>
          {feedback ? (
            <a
              href={feedback}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-action px-4 py-1.5 text-xs font-medium text-action-foreground transition-colors hover:bg-action-hover"
            >
              <MessageSquareWarning className="size-3.5" /> Request more runs
            </a>
          ) : null}
        </div>

        <div className="mt-6 flex items-center justify-center gap-3 text-[11px] text-ink-muted">
          {user?.email ? <span>Signed in as {user.email}</span> : null}
          <button
            onClick={() => void signOut()}
            className="inline-flex cursor-pointer items-center gap-1 underline-offset-4 hover:text-ink hover:underline"
          >
            <LogOut className="size-3" /> Sign out
          </button>
        </div>
      </motion.div>
    </div>
  );
}

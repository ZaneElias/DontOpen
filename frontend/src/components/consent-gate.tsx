"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2, ShieldCheck } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { AnimatedCheckbox } from "@/components/ui/field";

/**
 * Blocks the app until the user accepts a policy.
 *
 * The document is rendered verbatim from a single markdown source in /public,
 * so the legal copy has exactly one home and is never duplicated or paraphrased
 * in component code. Acceptance writes a timestamp column on the user's profile.
 */
export function ConsentGate({
  title,
  intro,
  sourceUrl,
  column,
  confirmLabel,
  inlineContent,
}: {
  title: string;
  intro: string;
  /** Markdown file to display, e.g. "/privacy-policy.md". */
  sourceUrl?: string;
  /** Profile column to stamp, e.g. "privacy_accepted_at". */
  column: "privacy_accepted_at" | "beta_consent_accepted_at";
  confirmLabel: string;
  /** Used instead of sourceUrl when the copy is short enough to live inline. */
  inlineContent?: React.ReactNode;
}) {
  const { user, refreshProfile, signOut } = useAuth();
  const reduce = useReducedMotion();
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sourceUrl) return;
    let alive = true;
    fetch(sourceUrl)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`${r.status}`))))
      .then((text) => alive && setMarkdown(text))
      .catch(() => alive && setMarkdown("_Could not load the document. Please refresh._"));
    return () => {
      alive = false;
    };
  }, [sourceUrl]);

  async function accept() {
    if (!user || !checked) return;
    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ [column]: new Date().toISOString() })
      .eq("id", user.id);
    if (updateError) {
      setError(updateError.message);
      setBusy(false);
      return;
    }
    await refreshProfile();
    setBusy(false);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-transparent p-4 text-ink">
      <div className="liquid-glass backdrop-blur-xl flex w-full max-w-3xl flex-col rounded-2xl">
        <header className="flex items-start gap-3 border-b border-line/60 p-6">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-action/15">
            <ShieldCheck className="size-4 text-action" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="cp-display text-2xl text-ink">{title}</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{intro}</p>
          </div>
          {/* Escape hatch: without this, a signed-in user who doesn't want to
              accept is stuck here with no route back to the login screen. */}
          <button
            onClick={() => void signOut()}
            className="shrink-0 cursor-pointer rounded-full border border-line px-2.5 py-1 text-[11px] font-medium text-ink-muted cp-transition hover:border-line-strong hover:text-ink"
          >
            Sign out
          </button>
        </header>

        <div className="max-h-[46vh] overflow-y-auto px-6 py-5">
          {inlineContent ? (
            inlineContent
          ) : markdown === null ? (
            <div className="flex items-center gap-2 text-sm text-ink-muted">
              <Loader2 className="size-4 animate-spin" /> Loading document…
            </div>
          ) : (
            <article className="cp-prose text-sm leading-relaxed text-ink-muted">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
            </article>
          )}
        </div>

        <footer className="flex flex-col gap-3 border-t border-line/60 p-6">
          {user?.email ? (
            <p className="text-[11px] text-ink-muted">
              Signed in as <span className="font-medium text-ink">{user.email}</span>
            </p>
          ) : null}
          <AnimatedCheckbox checked={checked} onChange={setChecked} label={confirmLabel} />
          {error ? <p className="text-[11px] text-status-flag">{error}</p> : null}
          <motion.button
            onClick={accept}
            disabled={!checked || busy}
            whileHover={reduce || !checked ? undefined : { scale: 1.01 }}
            whileTap={reduce || !checked ? undefined : { scale: 0.98 }}
            className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 self-start rounded-lg bg-action px-6 text-sm font-medium text-action-foreground shadow-lg shadow-action/25 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Agree and continue
          </motion.button>
        </footer>
      </div>
    </div>
  );
}

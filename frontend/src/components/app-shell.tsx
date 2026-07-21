"use client";

import { AnimatePresence, motion } from "framer-motion";
import { PhoneCall, ShieldCheck, AlertTriangle, RotateCcw, LogOut, UserRound, MessageSquareWarning } from "lucide-react";
import { StageProgress } from "@/components/stage-progress";
import { ThemeToggle } from "@/components/theme-toggle";
import type { HealthStatus, Stage } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AppShell({
  stage,
  furthestReached,
  onNavigate,
  health,
  onNewJob,
  user,
  onSignOut,
  children,
}: {
  stage: Stage;
  furthestReached: Stage;
  onNavigate: (stage: Stage) => void;
  health: HealthStatus | null;
  onNewJob?: () => void;
  user?: { name?: string | null; email?: string | null; image?: string | null } | null;
  onSignOut?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-transparent">
      <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-md bg-action text-action-foreground">
                <PhoneCall className="size-4" />
              </div>
              <span className="font-serif text-lg font-semibold tracking-tight text-ink">CallPilot</span>
            </div>
            <div className="flex items-center gap-2 sm:hidden">
              <NewJobButton onNewJob={onNewJob} />
              <ThemeToggle />
              <AccountChip user={user} onSignOut={onSignOut} />
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 sm:justify-end">
            <StageProgress current={stage} furthestReached={furthestReached} onNavigate={onNavigate} />
            <div className="hidden items-center gap-2 sm:flex">
              <FeedbackLink />
              <NewJobButton onNewJob={onNewJob} />
              <ThemeToggle />
              <ConfigPill health={health} />
              <AccountChip user={user} onSignOut={onSignOut} />
            </div>
          </div>
        </div>
      </header>

      <div className="border-b border-line bg-status-live-bg/40">
        <p className="mx-auto max-w-5xl px-4 py-1.5 text-xs text-ink-muted sm:px-6">
          {health?.call_mode === "telephony"
            ? "Places real outbound calls on your behalf and records them for your report."
            : "Runs live agent-to-agent negotiations and keeps full transcripts for your report."}{" "}
          Nothing runs until you confirm your details, and everything is kept only for this session.
        </p>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={stage}
            initial={{ opacity: 0, y: 18, scale: 0.985, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, scale: 0.99, filter: "blur(4px)" }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

/**
 * Shows the *actual* auth state — the signed-in Google identity, or "Guest" —
 * with a working sign-out that returns to the login screen.
 */
function AccountChip({
  user,
  onSignOut,
}: {
  user?: { name?: string | null; email?: string | null; image?: string | null } | null;
  onSignOut?: () => void;
}) {
  if (!onSignOut) return null;
  const label = user?.name?.split(" ")[0] ?? (user?.email ? user.email.split("@")[0] : "Guest");
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-line py-0.5 pl-0.5 pr-0.5">
      <span className="flex items-center gap-1.5 pl-1.5">
        {user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="size-5 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <span className="flex size-5 items-center justify-center rounded-full bg-ink/10">
            <UserRound className="size-3 text-ink-muted" />
          </span>
        )}
        <span className="max-w-24 truncate text-xs font-medium text-ink">{label}</span>
      </span>
      <button
        onClick={onSignOut}
        title={user ? "Sign out" : "Leave demo"}
        aria-label={user ? "Sign out" : "Leave demo"}
        className="flex size-6 cursor-pointer items-center justify-center rounded-full text-ink-muted cp-transition hover:bg-ink/10 hover:text-ink"
      >
        <LogOut className="size-3.5" />
      </button>
    </div>
  );
}

/**
 * Persistent beta feedback entry point. Target comes from
 * NEXT_PUBLIC_FEEDBACK_URL (a mailto: or form link) so it can be changed
 * without a code edit.
 */
function FeedbackLink() {
  const target = process.env.NEXT_PUBLIC_FEEDBACK_URL;
  if (!target) return null;
  const isExternal = /^https?:/i.test(target);
  return (
    <a
      href={target}
      {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      title="Report an issue with the beta"
      className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs font-medium text-ink-muted cp-transition hover:border-line-strong hover:text-ink"
    >
      <MessageSquareWarning className="size-3.5" /> Report an issue
    </a>
  );
}

function NewJobButton({ onNewJob }: { onNewJob?: () => void }) {
  if (!onNewJob) return null;
  return (
    <button
      onClick={onNewJob}
      title="Start a fresh comparison"
      className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs font-medium text-ink-muted cp-transition hover:border-line-strong hover:text-ink"
    >
      <RotateCcw className="size-3.5" /> New job
    </button>
  );
}

function ConfigPill({ health }: { health: HealthStatus | null }) {
  if (!health) {
    return <span className="text-xs text-ink-muted">Checking setup…</span>;
  }
  const ready = health.ready_for_calls;
  const readyLabel = health.call_mode === "telephony" ? "Live calls ready" : "Simulation ready";
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        ready ? "border-status-done/30 bg-status-done-bg text-status-done" : "border-status-live/30 bg-status-live-bg text-status-live"
      )}
      title={ready ? `All required ${health.call_mode} configuration is present.` : `${health.missing_required_count} required setting(s) missing.`}
    >
      {ready ? <ShieldCheck className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
      {ready ? readyLabel : `${health.missing_required_count} setting${health.missing_required_count === 1 ? "" : "s"} needed`}
    </div>
  );
}

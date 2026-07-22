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
  freeUsesRemaining,
  children,
}: {
  stage: Stage;
  furthestReached: Stage;
  onNavigate: (stage: Stage) => void;
  health: HealthStatus | null;
  onNewJob?: () => void;
  user?: { name?: string | null; email?: string | null; image?: string | null } | null;
  onSignOut?: () => void;
  freeUsesRemaining?: number | null;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-transparent">
      <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
        {/* One row. The cramping came from squeezing everything into max-w-5xl
            on a wide screen, which forced labels like "New job" and
            "Simulation ready" to wrap onto two lines. Widening the bar and
            pinning labels to a single line gives each group real breathing
            room instead of stacking them. */}
        {/* Three-column grid with equal, shrinkable side tracks. Absolute
            centring put the tracker on top of the controls once both got wide;
            in a grid the columns reserve their own space, so an overlap is
            structurally impossible while the middle column still lands on the
            bar's true centre. */}
        <div className="mx-auto grid w-full max-w-[88rem] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-4 py-3 sm:px-6">
          {/* End-aligned in its column so the brand sits next to the tracker
              rather than stranded against the far edge with a gap of dead space
              between them. */}
          <div className="flex min-w-0 shrink-0 items-center gap-2.5 justify-self-end pr-2 xl:pr-6">
            <div className="flex size-9 items-center justify-center rounded-lg bg-action text-action-foreground">
              <PhoneCall className="size-5" />
            </div>
            <span className="font-serif text-xl font-semibold tracking-tight text-ink">CallPilot</span>
          </div>

          {/* Absolutely centred rather than flexed into the gap: the control
              cluster is far wider than the logo, so an in-flow centre lands
              noticeably left of the bar's actual midpoint. pointer-events are
              re-enabled only on the tracker itself so the overlay can't
              swallow clicks meant for the header. */}
          {/* Inline only from xl. Below that the three groups genuinely cannot
              fit on one line, and forcing them to is what made "4 Report" run
              into the usage chip - it drops to its own row instead. */}
          <div className="hidden justify-self-center xl:block">
            <StageProgress current={stage} furthestReached={furthestReached} onNavigate={onNavigate} />
          </div>

          {/* Kept as tight as the content allows: gap-1 between groups and a
              single hairline container around the icon buttons, so they read as
              one control cluster without any label colliding. */}
          {/* Start-aligned, mirroring the brand column, so the controls sit
              beside the tracker instead of being flung to the far edge — the
              whole bar then reads as one centred group. */}
          <div className="flex shrink-0 items-center gap-1.5 justify-self-start pl-2 xl:pl-6">
            <UsageChip remaining={freeUsesRemaining} />
            <span className="hidden sm:inline-flex">
              <ConfigPill health={health} />
            </span>
            <span className="flex items-center gap-0.5 rounded-full border border-line/70 px-1 py-0.5">
              <NewJobButton onNewJob={onNewJob} />
              <FeedbackLink />
              <ThemeToggle />
            </span>
            <AccountChip user={user} onSignOut={onSignOut} />
          </div>
        </div>

        {/* Tracker only drops below the bar on narrow screens, where it genuinely
            cannot fit alongside everything else. */}
        <div className="flex justify-center border-t border-line/40 px-4 py-2 xl:hidden">
          <StageProgress current={stage} furthestReached={furthestReached} onNavigate={onNavigate} />
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

      {/* Always reachable after acceptance — otherwise the policy is only ever
          visible once, on the gate, and never again. */}
      <footer className="mx-auto w-full max-w-5xl px-4 pb-8 text-[11px] text-ink-muted sm:px-6 print:hidden">
        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:text-ink hover:underline">
          Privacy Policy
        </a>
      </footer>
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
    <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-line py-0.5 pl-0.5 pr-0.5">
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
 * Remaining free comparisons. Warns as it runs low so the limit is never a
 * surprise at the moment someone tries to start a run.
 */
function UsageChip({ remaining }: { remaining?: number | null }) {
  if (remaining == null) return null;
  const tone =
    remaining <= 0
      ? "border-status-flag/40 bg-status-flag-bg text-status-flag"
      : remaining === 1
        ? "border-status-live/40 bg-status-live-bg text-status-live"
        : "border-line text-ink-muted";
  return (
    <span
      title={`${remaining} free comparison${remaining === 1 ? "" : "s"} left on this account`}
      className={cn("whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium", tone)}
    >
      {remaining > 0 ? `${remaining} left` : "No runs left"}
    </span>
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
      aria-label="Report an issue with the beta"
      className="flex size-7 items-center justify-center rounded-full text-ink-muted cp-transition hover:bg-ink/10 hover:text-ink"
    >
      <MessageSquareWarning className="size-3.5" />
    </a>
  );
}

function NewJobButton({ onNewJob }: { onNewJob?: () => void }) {
  if (!onNewJob) return null;
  return (
    <button
      onClick={onNewJob}
      title="Start a fresh comparison"
      aria-label="Start a fresh comparison"
      className="flex size-7 items-center justify-center rounded-full text-ink-muted cp-transition hover:bg-ink/10 hover:text-ink"
    >
      <RotateCcw className="size-3.5" />
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
        "flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium",
        ready ? "border-status-done/30 bg-status-done-bg text-status-done" : "border-status-live/30 bg-status-live-bg text-status-live"
      )}
      title={ready ? `All required ${health.call_mode} configuration is present.` : `${health.missing_required_count} required setting(s) missing.`}
    >
      {ready ? <ShieldCheck className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
      {/* Full wording only where there's room; the icon + tooltip carry it otherwise. */}
      <span className="hidden lg:inline">
        {ready ? readyLabel : `${health.missing_required_count} setting${health.missing_required_count === 1 ? "" : "s"} needed`}
      </span>
      <span className="lg:hidden">{ready ? "Ready" : health.missing_required_count}</span>
    </div>
  );
}

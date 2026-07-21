"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ConsentGate } from "@/components/consent-gate";
import { UsageExhausted } from "@/components/usage-exhausted";
import { InviteGate } from "@/components/invite-gate";
import { REQUIRE_INVITE_CODE } from "@/lib/access";
import { RotateCcw } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BriefStage, BriefStageSkeleton } from "@/components/brief-stage";
import { CallsStage } from "@/components/calls-stage";
import { NegotiateStage } from "@/components/negotiate-stage";
import { ReportStage } from "@/components/report-stage";
import { LoginScreen } from "@/components/login-screen";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { api, ApiError } from "@/lib/api-client";
import { session } from "@/lib/session";
import type { HealthStatus, JobSpec, Stage } from "@/lib/types";

const STAGE_ORDER: Stage[] = ["brief", "calls", "negotiate", "report"];

function furthest(a: Stage, b: Stage): Stage {
  return STAGE_ORDER.indexOf(a) >= STAGE_ORDER.indexOf(b) ? a : b;
}

export default function Page() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [job, setJob] = useState<JobSpec | null>(null);
  const [stage, setStage] = useState<Stage>("brief");
  const [furthestReached, setFurthestReached] = useState<Stage>("brief");
  const [sessionExpired, setSessionExpired] = useState(false);
  // Set when the backend reports the account is out of free comparisons (402).
  const [usageExhausted, setUsageExhausted] = useState(false);
  const [initializing, setInitializing] = useState(true);
  // `session` here is the sessionStorage helper; auth state comes from Supabase.
  const { user, loading: authLoading, signOut, profile, profileLoading } = useAuth();

  const loadHealth = useCallback(() => {
    api.health().then(setHealth).catch(() => {});
  }, []);

  useEffect(() => {
    loadHealth();
    const id = setInterval(loadHealth, 30000);
    return () => clearInterval(id);
  }, [loadHealth]);

  // If any request discovers the backend lost this job (restart/redeploy),
  // surface the recovery screen instead of letting a dead session linger.
  useEffect(() => {
    const onMissing = () => setSessionExpired(true);
    window.addEventListener("callpilot:job-missing", onMissing);
    return () => window.removeEventListener("callpilot:job-missing", onMissing);
  }, []);

  const startFresh = useCallback(async (vertical?: string) => {
    // Guard: this is also wired to onClick handlers, which would pass a
    // MouseEvent as the first arg — coerce anything non-string to the default.
    const chosen = typeof vertical === "string" ? vertical : "moving";
    session.clear();
    setSessionExpired(false);
    setInitializing(true);
    try {
      setUsageExhausted(false);
      const newJob = await api.createIntake(chosen);
      session.setJobId(newJob.job_id);
      session.setStage("brief");
      setJob(newJob);
      setStage("brief");
      setFurthestReached("brief");
    } catch (err) {
      // 402 means the account has spent all its free comparisons - a real
      // product state, not a connectivity failure, so surface it as its own screen.
      if (err instanceof ApiError && err.status === 402) {
        setUsageExhausted(true);
      }
      // anything else: the health panel surfaces the connectivity problem
    } finally {
      setInitializing(false);
    }
  }, []);

  useEffect(() => {
    const existingJobId = session.getJobId();
    if (!existingJobId) {
      void Promise.resolve().then(() => startFresh());
      return;
    }
    api
      .getIntake(existingJobId)
      .then((existingJob) => {
        setJob(existingJob);
        const savedStage = session.getStage() ?? "brief";
        const resolvedStage = existingJob.confirmed ? savedStage : "brief";
        setStage(resolvedStage);
        setFurthestReached(resolvedStage);
        setInitializing(false);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setSessionExpired(true);
          setInitializing(false);
        } else {
          setInitializing(false);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Real sign-out for both entry paths: a Google session is cleared via
   * Auth.js, and the guest gate is reset. Also wipes the job session and
   * provisions a fresh one so re-entering doesn't land on a dead job.
   */
  async function handleSignOut() {
    session.clear();
    await signOut();
    void startFresh();
  }

  function goToStage(next: Stage) {
    setStage(next);
    session.setStage(next);
    setFurthestReached((prev) => furthest(prev, next));
  }

  function handleJobUpdated(updated: JobSpec) {
    setJob(updated);
  }

  function handleConfirmed(confirmed: JobSpec) {
    setJob(confirmed);
    goToStage("calls");
  }

  // Auth is the only gate now: no session, no app.
  if (authLoading) {
    return null;
  }
  if (!user) {
    return <LoginScreen />;
  }

  // Consent gates run before any app access. Wait for the profile so an
  // already-accepted user never sees the screen flash.
  if (profileLoading && !profile) {
    return null;
  }
  // Google OAuth skips the signup form, so when the closed beta is armed the
  // code is collected here instead. Runs before the consent gates so an
  // ungated account never reaches the app.
  if (REQUIRE_INVITE_CODE && profile && !profile.invite_code_redeemed_at) {
    return <InviteGate />;
  }
  if (profile && profile.privacy_accepted_at && !profile.beta_consent_accepted_at) {
    return (
      <ConsentGate
        title="Before you start — this is a beta"
        intro="A few things to know before your first comparison."
        column="beta_consent_accepted_at"
        confirmLabel="I understand and want to continue"
        inlineContent={
          <ul className="cp-prose space-y-3 text-sm leading-relaxed text-ink-muted">
            <li>
              <strong>This is early software.</strong> You may hit rough edges, and results won&apos;t always be
              perfect. Please tell us when something breaks — that&apos;s the point of the beta.
            </li>
            <li>
              <strong>Calls are recorded and transcribed.</strong> CallPilot&apos;s agent identifies itself as an AI
              calling on your behalf, and the recording and transcript are kept so you can check the evidence behind
              every quote in your report.
            </li>
            <li>
              <strong>In live telephony mode it calls real businesses on your behalf.</strong> Real people answer
              those calls. Only start a run when you actually want those calls placed.
            </li>
            <li>
              <strong>Don&apos;t rely on it for anything binding.</strong> Quotes gathered here are not contracts,
              and the agent can misunderstand. Confirm anything important directly with the business.
            </li>
          </ul>
        }
      />
    );
  }
  if (profile && !profile.privacy_accepted_at) {
    return (
      <ConsentGate
        title="Privacy Policy"
        intro="Please read and accept before using CallPilot. This covers what we collect, who we share it with, and how call recordings are handled."
        sourceUrl="/privacy-policy.md"
        column="privacy_accepted_at"
        confirmLabel="I have read and accept the Privacy Policy"
      />
    );
  }

  if (sessionExpired) {
    return (
      <AppShell stage="brief" furthestReached="brief" onNavigate={() => {}} health={health}>
        <Alert variant="warning">
          <AlertTitle>Your session expired</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              CallPilot keeps job state in memory on the backend — a server restart or redeploy clears it. Start a
              new job to continue; nothing about your previous move details was saved.
            </p>
            <Button size="sm" onClick={() => startFresh()}>
              <RotateCcw className="size-3.5" /> Start a new job
            </Button>
          </AlertDescription>
        </Alert>
      </AppShell>
    );
  }

  if (usageExhausted || (profile && profile.free_uses_remaining <= 0 && !job)) {
    return (
      <AppShell
        stage="brief"
        furthestReached="brief"
        onNavigate={() => {}}
        health={health}
        user={user ? { name: user.user_metadata?.full_name ?? null, email: user.email ?? null, image: user.user_metadata?.avatar_url ?? null } : null}
        onSignOut={handleSignOut}
        freeUsesRemaining={profile?.free_uses_remaining ?? 0}
      >
        <UsageExhausted />
      </AppShell>
    );
  }

  if (initializing || !job) {
    return (
      <AppShell stage="brief" furthestReached="brief" onNavigate={() => {}} health={health}>
        <BriefStageSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell
      stage={stage}
      furthestReached={furthestReached}
      onNavigate={goToStage}
      health={health}
      onNewJob={() => startFresh()}
      user={user ? { name: user.user_metadata?.full_name ?? null, email: user.email ?? null, image: user.user_metadata?.avatar_url ?? null } : null}
      onSignOut={handleSignOut}
      freeUsesRemaining={profile?.free_uses_remaining ?? null}
    >
      {stage === "brief" && (
        <BriefStage
          job={job}
          health={health}
          onJobUpdated={handleJobUpdated}
          onConfirmed={handleConfirmed}
          onSwitchVertical={(v) => startFresh(v)}
        />
      )}
      {stage === "calls" && (
        <CallsStage job={job} health={health} onCallsStarted={() => {}} onAdvance={() => goToStage("negotiate")} />
      )}
      {stage === "negotiate" && <NegotiateStage job={job} health={health} onAdvance={() => goToStage("report")} />}
      {stage === "report" && <ReportStage job={job} />}
    </AppShell>
  );
}

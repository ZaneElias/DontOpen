"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
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
  const [initializing, setInitializing] = useState(true);
  // `session` here is the sessionStorage helper; auth state comes from Supabase.
  const { user, loading: authLoading, signOut } = useAuth();

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
      const newJob = await api.createIntake(chosen);
      session.setJobId(newJob.job_id);
      session.setStage("brief");
      setJob(newJob);
      setStage("brief");
      setFurthestReached("brief");
    } catch {
      // health panel will show the connectivity problem
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

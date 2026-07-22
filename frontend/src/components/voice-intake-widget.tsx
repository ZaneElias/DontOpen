"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Mic } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { api } from "@/lib/api-client";
import type { JobSpecSchema } from "@/lib/types";

const WIDGET_SCRIPT_SRC = "https://unpkg.com/@elevenlabs/convai-widget-embed";

/**
 * Embeds the ElevenLabs <elevenlabs-convai> voice-interview widget when
 * ELEVENLABS_INTERVIEW_AGENT_ID is configured server-side. The agent
 * (prompts/interview_agent.md) calls log_intake_field, wired in the
 * ElevenLabs dashboard to POST /api/intake/{job_id}/voice-tool — the job_id
 * is passed in as a dynamic variable below so the tool call knows which job
 * to update.
 *
 * `dynamic-variables` is the documented widget attribute (a JSON string); the
 * job_id passed here is what the agent interpolates into its log_intake_field
 * tool call. Caveat: that tool is a *webhook*, so field-logging only reaches
 * this backend when WEBHOOK_BASE_URL is configured. Without it the widget can
 * still hold the voice conversation, but use the manual form to persist the
 * spec — it produces the identical JobSpec.
 *
 * The agent is vertical-agnostic: rather than hardcoding one trade's questions,
 * it receives `vertical_display` and a `fields_to_collect` checklist rendered
 * from the active vertical's own job_spec_schema (the `asked_by_interview`
 * fields). Same config-driven property as GenericIntakeForm — a new vertical
 * gets a working voice interview with no prompt edit.
 */
export function VoiceIntakeWidget({
  agentId,
  jobId,
  verticalDisplay,
}: {
  agentId: string | null;
  jobId: string;
  verticalDisplay: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [schema, setSchema] = useState<JobSpecSchema | null>(null);
  const [schemaFailed, setSchemaFailed] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let alive = true;
    setSchema(null);
    setSchemaFailed(false);
    api
      .getIntakeSchema(jobId)
      .then((s) => alive && setSchema(s))
      .catch(() => alive && setSchemaFailed(true));
    return () => {
      alive = false;
    };
  }, [jobId]);

  useEffect(() => {
    if (!agentId) return;
    if (document.querySelector(`script[src="${WIDGET_SCRIPT_SRC}"]`)) return;
    const script = document.createElement("script");
    script.src = WIDGET_SCRIPT_SRC;
    script.async = true;
    document.head.appendChild(script);
  }, [agentId]);

  // The agent can't start without its question list, so say so plainly rather
  // than rendering an explainer for a bubble that will never appear.
  if (schemaFailed) {
    return (
      <Alert>
        <Mic className="mt-0.5" />
        <AlertTitle>Voice interview unavailable</AlertTitle>
        <AlertDescription>
          Couldn&apos;t load the question list for this job, so the assistant can&apos;t start. Use the form below —
          it produces the exact same job spec.
        </AlertDescription>
      </Alert>
    );
  }

  if (!agentId) {
    return (
      <Alert>
        <Mic className="mt-0.5" />
        <AlertTitle>Voice interview not configured</AlertTitle>
        <AlertDescription>
          Set <code>ELEVENLABS_INTERVIEW_AGENT_ID</code> on the backend to enable live voice intake. Use the form
          below in the meantime — it produces the exact same job spec.
        </AlertDescription>
      </Alert>
    );
  }

  // The <elevenlabs-convai> widget renders a position:fixed bubble. Rendered
  // inline it would be trapped by any ancestor with transform/filter/
  // backdrop-filter (the glass cards + the cinematic stage transition), which
  // re-anchors fixed elements to that ancestor instead of the viewport. So we
  // portal it to <body> — outside the animated app subtree — where its
  // bottom-right positioning stays glued to the viewport as intended.
  const Widget = "elevenlabs-convai" as any;
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-line bg-paper p-6 text-center">
      <p className="max-w-sm text-sm text-ink-muted">
        The voice assistant opens as a bubble at the{" "}
        <span className="font-medium text-ink">bottom-right of your screen</span>. Click it, allow your microphone,
        and talk through your {verticalDisplay}.
      </p>
      {/* Wait for the schema before mounting: dynamic-variables are read once at
          widget init, so mounting early would start an agent with an empty
          checklist and no way to hand it one afterwards. */}
      {mounted &&
        schema &&
        createPortal(
          <Widget
            agent-id={agentId}
            dynamic-variables={JSON.stringify({
              job_id: jobId,
              vertical_display: verticalDisplay,
              fields_to_collect: describeFields(schema),
            })}
            action-text="Talk to the CallPilot intake assistant"
            start-call-text="Start voice interview"
            end-call-text="End interview"
          />,
          document.body
        )}
    </div>
  );
}

/**
 * Renders the vertical's schema as a plain-text checklist for the agent's
 * prompt. Only `asked_by_interview` fields appear — the rest (document-derived
 * or computed) aren't things a customer can answer out loud.
 */
function describeFields(schema: JobSpecSchema): string {
  const lines: string[] = [];
  for (const [name, def] of Object.entries(schema)) {
    if (!def.asked_by_interview) continue;
    const parts = [def.required ? "required" : "optional", def.type];
    if (def.enum?.length) parts.push(`one of: ${def.enum.join(", ")}`);
    let line = `- ${name} (${parts.join(", ")})`;
    if (def.description) line += ` — ${def.description}`;
    lines.push(line);
  }
  return lines.join("\n");
}

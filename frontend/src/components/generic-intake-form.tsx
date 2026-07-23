"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { FloatingField, AnimatedCheckbox, TiltCard } from "@/components/ui/field";
import { Stagger, StaggerItem } from "@/components/ui/motion";
import { FieldError } from "@/components/ui/field-error";
import { useLocationCheck } from "@/hooks/use-location-check";
import { api, ApiError } from "@/lib/api-client";
import { humanizeFieldList } from "@/lib/utils";
import type { JobSpec, JobSpecSchema } from "@/lib/types";

/**
 * Schema-driven intake form. Renders inputs straight from the active vertical's
 * job_spec_schema (fetched from the backend), so a brand-new vertical gets a
 * working form with zero form code — the config-driven claim, made literal.
 */
export function GenericIntakeForm({
  job,
  onJobUpdated,
  onConfirmed,
}: {
  job: JobSpec;
  onJobUpdated: (job: JobSpec) => void;
  onConfirmed: (job: JobSpec) => void;
}) {
  const locationCheck = useLocationCheck();
  const [schema, setSchema] = useState<JobSpecSchema | null>(null);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [syncedJobId, setSyncedJobId] = useState("");

  useEffect(() => {
    let alive = true;
    api.getIntakeSchema(job.job_id).then((s) => alive && setSchema(s)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [job.job_id]);

  // Seed values from the job when the schema arrives or the job changes.
  if (schema && job.job_id !== syncedJobId) {
    setSyncedJobId(job.job_id);
    const seed: Record<string, string | boolean> = {};
    for (const [k, def] of Object.entries(schema)) {
      const v = job.fields[k];
      seed[k] = def.type === "boolean" ? Boolean(v) : Array.isArray(v) ? v.join(", ") : v != null ? String(v) : "";
    }
    setValues(seed);
  }

  if (!schema) return <Skeleton className="h-72 w-full" />;

  function set(key: string, v: string | boolean) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function buildPayload(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, def] of Object.entries(schema!)) {
      const v = values[k];
      if (def.type === "boolean") out[k] = Boolean(v);
      else if (v === "" || v == null) continue;
      else if (def.type === "number") out[k] = Number(v);
      else if (def.type === "array") out[k] = String(v).split(",").map((s) => s.trim()).filter(Boolean);
      else out[k] = v;
    }
    return out;
  }

  async function handleSave() {
    setSaving(true);
    try {
      onJobUpdated(await api.updateIntake(job.job_id, buildPayload(), "manual_form"));
      toast.success("Details saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirm(allowUnverifiedLocation = false) {
    setConfirming(true);
    try {
      await api.updateIntake(job.job_id, buildPayload(), "manual_form");
      const confirmed = await api.confirmIntake(job.job_id, allowUnverifiedLocation);
      onConfirmed(confirmed);
      toast.success("Job spec confirmed");
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const detail = (err.body as {
          detail?: { error?: string; message?: string; missing_fields?: string[] };
        })?.detail;
        if (detail?.error === "unverified_location") {
          toast.error("Check the address", {
            description: detail.message,
            duration: 12000,
            action: { label: "It's correct", onClick: () => void handleConfirm(true) },
          });
          return;
        }
        const missing = detail?.missing_fields ?? [];
        toast.error("A few details are still needed", {
          description: `Please add ${humanizeFieldList(missing)} before continuing.`,
        });
      } else {
        toast.error(err instanceof ApiError ? err.message : "Could not confirm");
      }
    } finally {
      setConfirming(false);
    }
  }

  const humanize = (k: string) => k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

  // Same treatment the moving form gets — glass fields, floating labels,
  // cascading entrance, pointer tilt — but driven entirely off the schema, so
  // every vertical gets it without a hand-built form.
  return (
    <TiltCard max={3.5}>
      <Card className="animate-fade-up delay-2">
        <CardHeader>
          <CardTitle>Job details</CardTitle>
          <CardDescription>This becomes the exact spec every business hears — same details, every call.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Stagger gap={0.04} className="grid gap-3.5 sm:grid-cols-2">
            {Object.entries(schema).map(([key, def]) => {
              const label = humanize(key);
              // Free text needs the full width; so does an array, which is
              // entered as a comma-separated list.
              const isWide = key.includes("notes") || def.type === "array";

              if (def.type === "boolean") {
                return (
                  <StaggerItem key={key}>
                    <div className="cp-field flex items-center px-4 py-3.5">
                      <AnimatedCheckbox
                        label={label}
                        checked={Boolean(values[key])}
                        onChange={(v) => set(key, v)}
                      />
                    </div>
                  </StaggerItem>
                );
              }

              const value = String(values[key] ?? "");
              let control: React.ReactNode;

              if (def.enum) {
                control = (
                  <Select value={value} onValueChange={(v) => set(key, v)}>
                    <SelectTrigger className="cp-control h-auto justify-between border-0 bg-transparent shadow-none focus:ring-0">
                      <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {def.enum.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );
              } else if (isWide) {
                control = (
                  <textarea
                    rows={2}
                    className="cp-control resize-none"
                    value={value}
                    onChange={(e) => set(key, e.target.value)}
                    placeholder={def.type === "array" ? "comma-separated" : def.description}
                  />
                );
              } else {
                control = (
                  <input
                    type={def.type === "number" ? "number" : "text"}
                    className="cp-control"
                    value={value}
                    onChange={(e) => {
                      set(key, e.target.value);
                      if (def.is_location) locationCheck.clear(key);
                    }}
                    // Schema-driven, so any vertical that declares is_location
                    // gets the check with no code change here.
                    onBlur={def.is_location ? (e) => void locationCheck.check(key, e.target.value) : undefined}
                    placeholder={def.example?.[0] ?? def.description ?? ""}
                  />
                );
              }

              return (
                <StaggerItem key={key} className={isWide ? "sm:col-span-2" : undefined}>
                  <FloatingField label={label} filled={value !== ""} required={def.required}>
                    {control}
                  </FloatingField>
                  <FieldError message={locationCheck.errors[key]} />
                </StaggerItem>
              );
            })}
          </Stagger>

          <div className="flex flex-wrap gap-3 pt-2">
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null} Save details
          </Button>
          {/* Wrapped so the MouseEvent isn't passed in as the override flag. */}
          <Button onClick={() => void handleConfirm(false)} disabled={confirming}>
            {confirming ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Confirm &amp; continue to calls
            </Button>
          </div>
        </CardContent>
      </Card>
    </TiltCard>
  );
}

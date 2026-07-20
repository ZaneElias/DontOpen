"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api-client";
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

  async function handleConfirm() {
    setConfirming(true);
    try {
      await api.updateIntake(job.job_id, buildPayload(), "manual_form");
      const confirmed = await api.confirmIntake(job.job_id);
      onConfirmed(confirmed);
      toast.success("Job spec confirmed");
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const missing = (err.body as { detail?: { missing_fields?: string[] } })?.detail?.missing_fields ?? [];
        toast.error(`Missing required fields: ${missing.join(", ")}`);
      } else {
        toast.error(err instanceof ApiError ? err.message : "Could not confirm");
      }
    } finally {
      setConfirming(false);
    }
  }

  const humanize = (k: string) => k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

  return (
    <Card>
      <CardHeader>
        <CardTitle>Job details</CardTitle>
        <CardDescription>This becomes the exact spec every business hears — same details, every call.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {Object.entries(schema).map(([key, def]) => {
            const label = (
              <Label className="flex items-center gap-1">
                {humanize(key)}
                {def.required && <span className="text-status-flag">*</span>}
              </Label>
            );
            const isNotes = key.includes("notes");
            const cell = (inner: React.ReactNode) => (
              <div key={key} className={isNotes ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
                {label}
                {inner}
              </div>
            );
            if (def.enum) {
              return cell(
                <Select value={String(values[key] ?? "")} onValueChange={(v) => set(key, v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${humanize(key).toLowerCase()}`} />
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
            }
            if (def.type === "boolean") {
              return (
                <label key={key} className="flex cursor-pointer items-center gap-2 self-end text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={Boolean(values[key])}
                    onChange={(e) => set(key, e.target.checked)}
                    className="size-4 rounded border-line-strong accent-[var(--action)]"
                  />
                  {humanize(key)}
                </label>
              );
            }
            if (isNotes || def.type === "array") {
              return cell(
                <Textarea
                  value={String(values[key] ?? "")}
                  onChange={(e) => set(key, e.target.value)}
                  placeholder={def.type === "array" ? "comma-separated" : def.description}
                />
              );
            }
            return cell(
              <Input
                type={def.type === "number" ? "number" : "text"}
                value={String(values[key] ?? "")}
                onChange={(e) => set(key, e.target.value)}
                placeholder={def.example?.[0] ?? def.description ?? ""}
              />
            );
          })}
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null} Save details
          </Button>
          <Button onClick={handleConfirm} disabled={confirming}>
            {confirming ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Confirm &amp; continue to calls
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

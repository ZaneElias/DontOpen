"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Upload, Sparkles, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { VoiceIntakeWidget } from "@/components/voice-intake-widget";
import { Hero } from "@/components/hero";
import { GenericIntakeForm } from "@/components/generic-intake-form";
import { SectionHeader } from "@/components/ui/section";
import { FloatingField, AnimatedCheckbox, TiltCard } from "@/components/ui/field";
import { Stagger, StaggerItem } from "@/components/ui/motion";
import { cn, humanizeFieldList } from "@/lib/utils";
import { api, ApiError } from "@/lib/api-client";
import type { HealthStatus, JobSpec } from "@/lib/types";

type FormState = {
  origin_address: string;
  destination_address: string;
  move_date: string;
  bedrooms: string;
  inventory_size: string;
  large_items: string; // comma-separated in the UI, array on the wire
  stairs_origin: string;
  stairs_destination: string;
  elevator_origin: boolean;
  elevator_destination: boolean;
  long_carry_expected: boolean;
  packing_preference: string;
  special_handling_notes: string;
};

/**
 * Today in the user's own timezone, as YYYY-MM-DD.
 *
 * toISOString() alone would give UTC, which is the wrong day for anyone west of
 * Greenwich in the evening - and would let them pick "yesterday" locally.
 */
function todayISO(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function jobToForm(job: JobSpec): FormState {
  const f = job.fields;
  return {
    origin_address: (f.origin_address as string) ?? "",
    destination_address: (f.destination_address as string) ?? "",
    move_date: (f.move_date as string) ?? "",
    bedrooms: f.bedrooms != null ? String(f.bedrooms) : "",
    inventory_size: (f.inventory_size as string) ?? "",
    large_items: Array.isArray(f.large_items) ? (f.large_items as string[]).join(", ") : "",
    stairs_origin: f.stairs_origin != null ? String(f.stairs_origin) : "",
    stairs_destination: f.stairs_destination != null ? String(f.stairs_destination) : "",
    elevator_origin: Boolean(f.elevator_origin),
    elevator_destination: Boolean(f.elevator_destination),
    long_carry_expected: Boolean(f.long_carry_expected),
    packing_preference: (f.packing_preference as string) ?? "",
    special_handling_notes: (f.special_handling_notes as string) ?? "",
  };
}

export function BriefStage({
  job,
  health,
  onJobUpdated,
  onConfirmed,
  onSwitchVertical,
}: {
  job: JobSpec;
  health: HealthStatus | null;
  onJobUpdated: (job: JobSpec) => void;
  onConfirmed: (job: JobSpec) => void;
  onSwitchVertical: (vertical: string) => void;
}) {
  const isMoving = job.vertical === "moving";
  const verticalDisplay = isMoving ? "move" : job.vertical.replace(/_/g, " ");
  const [form, setForm] = useState<FormState>(() => jobToForm(job));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [syncedJobId, setSyncedJobId] = useState(job.job_id);

  // Reset the form when we're handed a different job (e.g. after "start a
  // new job") — done during render per React's guidance for adjusting state
  // from changed props, not in an effect.
  if (job.job_id !== syncedJobId) {
    setSyncedJobId(job.job_id);
    setForm(jobToForm(job));
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function buildFieldsPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    if (form.origin_address) payload.origin_address = form.origin_address;
    if (form.destination_address) payload.destination_address = form.destination_address;
    if (form.move_date) payload.move_date = form.move_date;
    if (form.bedrooms) payload.bedrooms = Number(form.bedrooms);
    if (form.inventory_size) payload.inventory_size = form.inventory_size;
    if (form.large_items.trim())
      payload.large_items = form.large_items.split(",").map((s) => s.trim()).filter(Boolean);
    if (form.stairs_origin !== "") payload.stairs_origin = Number(form.stairs_origin);
    if (form.stairs_destination !== "") payload.stairs_destination = Number(form.stairs_destination);
    payload.elevator_origin = form.elevator_origin;
    payload.elevator_destination = form.elevator_destination;
    payload.long_carry_expected = form.long_carry_expected;
    if (form.packing_preference) payload.packing_preference = form.packing_preference;
    if (form.special_handling_notes) payload.special_handling_notes = form.special_handling_notes;
    return payload;
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await api.updateIntake(job.job_id, buildFieldsPayload(), "manual_form");
      onJobUpdated(updated);
      toast.success("Details saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save details");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    const before = Object.keys(job.fields ?? {}).length;
    try {
      const updated = await api.uploadDocument(job.job_id, file);
      onJobUpdated(updated);
      setForm(jobToForm(updated));
      const added = Object.keys(updated.fields ?? {}).length - before;
      if (added > 0) {
        toast.success(`Read ${added} detail${added === 1 ? "" : "s"} from your document — they're filled into the form below.`);
      } else {
        toast.info("Couldn't read any move details from that image. It works best on an existing quote or inventory list — or just fill the form below.");
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Document extraction failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleConfirm() {
    setConfirming(true);
    try {
      await api.updateIntake(job.job_id, buildFieldsPayload(), "manual_form");
      const confirmed = await api.confirmIntake(job.job_id);
      onConfirmed(confirmed);
      toast.success("Job spec confirmed — nothing changes now without starting a new job");
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const missing = (err.body as { detail?: { missing_fields?: string[] } })?.detail?.missing_fields ?? [];
        toast.error("A few details are still needed", {
          description: `Please add ${humanizeFieldList(missing)} before continuing.`,
        });
      } else {
        toast.error(err instanceof ApiError ? err.message : "Could not confirm job spec");
      }
    } finally {
      setConfirming(false);
    }
  }

  const provenance = job.field_sources;

  return (
    <div className="space-y-6">
      <Hero />
      <SectionHeader
        eyebrow="Step 01 · Your brief"
        title={isMoving ? "Tell us about your" : `Tell us about your ${job.vertical.replace(/_/g, " ")}`}
        accent={isMoving ? "move" : "job"}
        subtitle="This becomes the exact job spec every business hears — the same details, in the same words, every call."
        right={<VerticalPicker current={job.vertical} onSwitch={onSwitchVertical} />}
      />

      {/* Every vertical gets the voice interview — the agent reads the active
          vertical's schema at runtime, so it asks auto-repair questions on an
          auto-repair job. */}
      <Card className="animate-fade-up delay-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-action" /> Voice interview
          </CardTitle>
          <CardDescription>Talk through your {verticalDisplay} — takes about three minutes.</CardDescription>
        </CardHeader>
        <CardContent>
          <VoiceIntakeWidget
            agentId={health?.interview_agent_id ?? null}
            jobId={job.job_id}
            verticalDisplay={verticalDisplay}
          />
        </CardContent>
      </Card>

      {isMoving ? (
        <>
      <Card className="animate-fade-up delay-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="size-4 text-action" /> Upload a photo, quote, or inventory list
          </CardTitle>
          <CardDescription>We&apos;ll extract what we can and show you exactly what came from it.</CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-line-strong bg-paper p-6 text-center cp-transition hover:border-action">
            {uploading ? <Loader2 className="size-5 animate-spin text-action" /> : <Upload className="size-5 text-ink-muted" />}
            <span className="text-sm text-ink-muted">
              {uploading ? "Extracting details…" : "Click to upload PNG / JPEG / WEBP — PDF pages must be exported as images first"}
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
                e.target.value = "";
              }}
            />
          </label>
        </CardContent>
      </Card>

      <TiltCard max={3.5}>
      <Card className="animate-fade-up delay-3">
        <CardHeader>
          <CardTitle>Move details</CardTitle>
          <CardDescription>Edit anything the interview or document upload got wrong — this is the spec that gets read to every mover.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Stagger gap={0.04} className="grid gap-3.5 sm:grid-cols-2">
            <StaggerItem>
              <FloatingField label="Moving from" filled={!!form.origin_address} badge={<ProvenanceBadge source={provenance.origin_address} />}>
                <input className="cp-control" value={form.origin_address} onChange={(e) => set("origin_address", e.target.value)} placeholder="Rock Hill, SC" />
              </FloatingField>
            </StaggerItem>
            <StaggerItem>
              <FloatingField label="Moving to" filled={!!form.destination_address} badge={<ProvenanceBadge source={provenance.destination_address} />}>
                <input className="cp-control" value={form.destination_address} onChange={(e) => set("destination_address", e.target.value)} placeholder="Charlotte, NC" />
              </FloatingField>
            </StaggerItem>
            <StaggerItem>
              <FloatingField label="Move date" filled={!!form.move_date} badge={<ProvenanceBadge source={provenance.move_date} />}>
                <input
                  type="date"
                  // A move can't be scheduled in the past, and a past date
                  // would send movers a nonsensical job spec.
                  min={todayISO()}
                  className={cn("cp-control", !form.move_date && "text-transparent focus:text-ink")}
                  value={form.move_date}
                  onChange={(e) => set("move_date", e.target.value)}
                />
              </FloatingField>
              {/* `min` only constrains the picker; a past date can still arrive
                  by typing or from document extraction, so flag it explicitly. */}
              {form.move_date && form.move_date < todayISO() ? (
                <p className="mt-1.5 px-1 text-[11px] text-status-flag">
                  That date has already passed — pick a future move date.
                </p>
              ) : null}
            </StaggerItem>
            <StaggerItem>
              <FloatingField label="Bedrooms" filled={!!form.bedrooms} badge={<ProvenanceBadge source={provenance.bedrooms} />}>
                <input type="number" min={0} className="cp-control" value={form.bedrooms} onChange={(e) => set("bedrooms", e.target.value)} placeholder="2" />
              </FloatingField>
            </StaggerItem>
            <StaggerItem>
              <FloatingField label="Inventory size" filled={!!form.inventory_size} badge={<ProvenanceBadge source={provenance.inventory_size} />}>
              <Select value={form.inventory_size} onValueChange={(v) => set("inventory_size", v)}>
                <SelectTrigger className="cp-control h-auto justify-between border-0 bg-transparent shadow-none focus:ring-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="studio">Studio</SelectItem>
                  <SelectItem value="1br">1 bedroom</SelectItem>
                  <SelectItem value="2br">2 bedroom</SelectItem>
                  <SelectItem value="3br">3 bedroom</SelectItem>
                  <SelectItem value="4br+">4+ bedroom</SelectItem>
                </SelectContent>
              </Select>
              </FloatingField>
            </StaggerItem>
            <StaggerItem>
              <FloatingField label="Packing preference" filled={!!form.packing_preference} badge={<ProvenanceBadge source={provenance.packing_preference} />}>
              <Select value={form.packing_preference} onValueChange={(v) => set("packing_preference", v)}>
                <SelectTrigger className="cp-control h-auto justify-between border-0 bg-transparent shadow-none focus:ring-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="self_pack">I&apos;ll pack myself</SelectItem>
                  <SelectItem value="full_pack">Full-service packing</SelectItem>
                  <SelectItem value="partial_pack">Partial packing help</SelectItem>
                </SelectContent>
              </Select>
              </FloatingField>
            </StaggerItem>
            <StaggerItem>
              <FloatingField label="Stairs at pickup (flights)" filled={form.stairs_origin !== ""} badge={<ProvenanceBadge source={provenance.stairs_origin} />}>
                <input type="number" min={0} className="cp-control" value={form.stairs_origin} onChange={(e) => set("stairs_origin", e.target.value)} placeholder="0" />
              </FloatingField>
            </StaggerItem>
            <StaggerItem>
              <FloatingField label="Stairs at drop-off (flights)" filled={form.stairs_destination !== ""} badge={<ProvenanceBadge source={provenance.stairs_destination} />}>
                <input type="number" min={0} className="cp-control" value={form.stairs_destination} onChange={(e) => set("stairs_destination", e.target.value)} placeholder="0" />
              </FloatingField>
            </StaggerItem>
            <StaggerItem className="sm:col-span-2">
              <div className="cp-field flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3.5">
                <AnimatedCheckbox label="Elevator at pickup" checked={form.elevator_origin} onChange={(v) => set("elevator_origin", v)} />
                <AnimatedCheckbox label="Elevator at drop-off" checked={form.elevator_destination} onChange={(v) => set("elevator_destination", v)} />
                <AnimatedCheckbox label="Long carry expected (truck can't park close)" checked={form.long_carry_expected} onChange={(v) => set("long_carry_expected", v)} />
              </div>
            </StaggerItem>
            <StaggerItem className="sm:col-span-2">
              <FloatingField label="Large or special items" filled={!!form.large_items} badge={<ProvenanceBadge source={provenance.large_items} />}>
                <input
                  className="cp-control"
                  value={form.large_items}
                  onChange={(e) => set("large_items", e.target.value)}
                  placeholder="piano, safe, pool table (comma-separated)"
                />
              </FloatingField>
            </StaggerItem>
            <StaggerItem className="sm:col-span-2">
              <FloatingField label="Anything else a mover should know" filled={!!form.special_handling_notes} badge={<ProvenanceBadge source={provenance.special_handling_notes} />}>
                <textarea
                  rows={3}
                  className="cp-control resize-y"
                  value={form.special_handling_notes}
                  onChange={(e) => set("special_handling_notes", e.target.value)}
                  placeholder="Tight parking, pets, HOA rules, timing constraints…"
                />
              </FloatingField>
            </StaggerItem>
          </Stagger>

          {job.needs_review.length > 0 && (
            <Alert variant="warning">
              <AlertTitle>Needs your review</AlertTitle>
              <AlertDescription>
                <ul className="list-disc space-y-0.5 pl-4">
                  {job.needs_review.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <Button variant="outline" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Save details
            </Button>
            <Button onClick={handleConfirm} disabled={confirming}>
              {confirming ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Confirm &amp; continue to calls
            </Button>
          </div>
        </CardContent>
      </Card>
      </TiltCard>
        </>
      ) : (
        <GenericIntakeForm job={job} onJobUpdated={onJobUpdated} onConfirmed={onConfirmed} />
      )}
    </div>
  );
}

function VerticalPicker({ current, onSwitch }: { current: string; onSwitch: (v: string) => void }) {
  const [verticals, setVerticals] = useState<{ vertical: string; display_name: string }[]>([]);
  useEffect(() => {
    api.listVerticals().then(setVerticals).catch(() => {});
  }, []);
  if (verticals.length <= 1) return null;
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-ink-muted">Market · config-driven</Label>
      <Select value={current} onValueChange={(v) => v !== current && onSwitch(v)}>
        <SelectTrigger className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {verticals.map((v) => (
            <SelectItem key={v.vertical} value={v.vertical}>
              {v.display_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ProvenanceBadge({ source }: { source?: string }) {
  if (!source) return null;
  const map: Record<string, { label: string; variant: "action" | "done" | "pending" }> = {
    voice_interview: { label: "from voice", variant: "action" },
    document: { label: "from document", variant: "done" },
    manual_form: { label: "you entered", variant: "pending" },
  };
  const cfg = map[source] ?? { label: source, variant: "pending" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export function BriefStageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

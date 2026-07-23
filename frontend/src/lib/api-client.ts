import {
  ApiError,
  type CallListResult,
  type CallRecord,
  type HealthStatus,
  type IntakeSource,
  type JobSpec,
  type JobSpecSchema,
  type NegotiationStyle,
  type Quote,
  type Report,
} from "@/lib/types";
import { getAccessToken } from "@/lib/supabase";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  // Attach the Supabase access token so the backend can verify the caller.
  const token = await getAccessToken();
  const headers: Record<string, string> = {};
  // FormData must set its own multipart boundary, so don't force a content type.
  if (!(init?.body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  Object.assign(headers, (init?.headers as Record<string, string> | undefined) ?? {});
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "Could not reach the CallPilot backend. Check your connection and try again.", null);
  }

  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* non-JSON error body */
    }
    const message =
      (body as { detail?: { message?: string } | string })?.detail &&
      typeof (body as { detail: { message?: string } | string }).detail === "object"
        ? ((body as { detail: { message?: string } }).detail.message ?? res.statusText)
        : typeof (body as { detail?: string })?.detail === "string"
          ? (body as { detail: string }).detail
          : res.statusText;
    // A missing-job 404 means the backend lost this job (restart/redeploy).
    // Broadcast it so the app can recover to a fresh job instead of the user
    // getting stuck on a dead session that only a new tab clears.
    //
    // Matched on the structured error code, not the prose: a route-ordering bug
    // once made /intake/place-suggest fall through to /intake/{job_id}, and
    // regexing the message meant a mistyped *endpoint* was reported to the user
    // as their session dying. Narrowed to real job routes so a non-job endpoint
    // can never nuke the session again.
    const code = (body as { detail?: { error?: string } })?.detail?.error;
    const isJobRoute = /^\/(intake|calls|quotes|negotiate|report)\/job_/.test(path);
    if (res.status === 404 && typeof window !== "undefined" && code === "job_not_found" && isJobRoute) {
      window.dispatchEvent(new CustomEvent("callpilot:job-missing"));
    }
    throw new ApiError(res.status, message || `Request failed (${res.status})`, body);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<HealthStatus>("/health"),

  createIntake: (vertical = "moving") =>
    request<JobSpec>("/intake", { method: "POST", body: JSON.stringify({ vertical }) }),

  listVerticals: () => request<{ vertical: string; display_name: string }[]>("/verticals"),

  getIntake: (jobId: string) => request<JobSpec>(`/intake/${jobId}`),

  getIntakeSchema: (jobId: string) => request<JobSpecSchema>(`/intake/${jobId}/schema`),

  updateIntake: (jobId: string, fields: Record<string, unknown>, source: IntakeSource = "manual_form") =>
    request<JobSpec>(`/intake/${jobId}/update`, {
      method: "POST",
      body: JSON.stringify({ fields, source }),
    }),

  uploadDocument: (jobId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<JobSpec>(`/intake/${jobId}/document`, { method: "POST", body: form });
  },

  suggestPlaces: (q: string) =>
    request<{ label: string; name: string; state: string | null; country: string | null; type: string }[]>(
      `/intake/place-suggest?q=${encodeURIComponent(q)}`
    ),

  confirmIntake: (jobId: string) => request<JobSpec>(`/intake/${jobId}/confirm`, { method: "POST" }),

  searchCallList: (category: string, location: string, maxResults = 8) =>
    request<CallListResult[]>(
      `/call-list/search?category=${encodeURIComponent(category)}&location=${encodeURIComponent(location)}&max_results=${maxResults}`
    ),

  counterpartyRoster: (vertical = "moving") =>
    request<{ style: string; description: string; configured: boolean; company_name?: string }[]>(
      `/calls/counterparty-roster?vertical=${encodeURIComponent(vertical)}`
    ),

  startCalls: (
    jobId: string,
    targets: { company_name: string; phone_number?: string; negotiation_style_label?: NegotiationStyle }[]
  ) => request<CallRecord[]>(`/calls/${jobId}/start`, { method: "POST", body: JSON.stringify({ targets }) }),

  // Simulation mode: agent-to-agent, no telephony. Runs the Caller against each
  // counterparty persona and captures the quote from the transcript.
  simulateCalls: (
    jobId: string,
    styles: NegotiationStyle[],
    businesses: { company_name: string; phone_number?: string; address?: string }[] = []
  ) =>
    request<CallRecord[]>(`/calls/${jobId}/simulate`, {
      method: "POST",
      body: JSON.stringify({ styles, businesses }),
    }),

  simulateNegotiation: (jobId: string, callbackCallIds: string[] = []) =>
    request<CallRecord[]>(`/negotiate/${jobId}/simulate`, {
      method: "POST",
      body: JSON.stringify({ callback_call_ids: callbackCallIds }),
    }),

  listCalls: (jobId: string, refresh = true) =>
    request<CallRecord[]>(`/calls/${jobId}?refresh=${refresh}`),

  listQuotes: (jobId: string) => request<Quote[]>(`/quotes/${jobId}`),

  startNegotiation: (jobId: string, callbackCallIds: string[] = []) =>
    request<CallRecord[]>(`/negotiate/${jobId}/start`, {
      method: "POST",
      body: JSON.stringify({ callback_call_ids: callbackCallIds }),
    }),

  getReport: (jobId: string) => request<Report>(`/report/${jobId}`),
};

export { ApiError };

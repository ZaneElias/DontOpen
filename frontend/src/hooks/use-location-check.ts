"use client";

import { useCallback, useRef, useState } from "react";
import { api } from "@/lib/api-client";

/**
 * Checks location fields against the backend geocoder so a bad address is
 * caught on blur, not after the whole spec is filled in.
 *
 * Only a definitive "not_found" produces an error. "unknown" — geocoder down,
 * rate-limited, timed out — is treated as no signal, matching the backend: an
 * outage must never stop someone completing a job.
 */
export function useLocationCheck() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Guards against an earlier, slower response overwriting a newer one when
  // fields are edited in quick succession.
  const latest = useRef<Record<string, string>>({});

  const check = useCallback(async (field: string, value: string) => {
    const q = value.trim();
    latest.current[field] = q;
    if (!q) {
      setErrors((p) => ({ ...p, [field]: "" }));
      return;
    }
    try {
      const { status } = await api.checkLocation(q);
      if (latest.current[field] !== q) return; // stale response
      setErrors((p) => ({
        ...p,
        [field]: status === "not_found" ? `We couldn't find "${q}" as a real place.` : "",
      }));
    } catch {
      // Never block on a failed check.
      setErrors((p) => ({ ...p, [field]: "" }));
    }
  }, []);

  const clear = useCallback((field: string) => {
    setErrors((p) => ({ ...p, [field]: "" }));
  }, []);

  return { errors, check, clear };
}

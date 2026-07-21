"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Volume2 } from "lucide-react";
import { getAccessToken } from "@/lib/supabase";

/**
 * <audio> for an endpoint that requires a bearer token.
 *
 * A plain <audio src="/api/..."> issues its own request and cannot carry an
 * Authorization header, so once the API required auth these silently 401'd and
 * the player just did nothing. This fetches the audio with the token, then
 * plays it from an object URL.
 */
export function AuthedAudio({ src, className }: { src: string; className?: string }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    // Revoke the previous blob when the source changes or we unmount.
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    };
  }, [src]);

  async function load() {
    if (objectUrl || state === "loading") return;
    setState("loading");
    try {
      const token = await getAccessToken();
      const res = await fetch(src, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        // Surface the backend's actual reason (e.g. TTS key missing) rather
        // than a generic failure.
        let reason = `Request failed (${res.status})`;
        try {
          const body = await res.json();
          reason = body?.detail?.message ?? reason;
        } catch {
          /* non-JSON error body */
        }
        throw new Error(reason);
      }
      const blob = await res.blob();
      // A zero-byte body is served as a valid 200 and renders as a dead
      // 0:00 / 0:00 player, which looks broken with no explanation.
      if (blob.size === 0) throw new Error("The server returned no audio for this transcript.");
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setObjectUrl(url);
      setState("idle");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : null);
      setState("error");
    }
  }

  if (objectUrl) {
    // eslint-disable-next-line jsx-a11y/media-has-caption
    return <audio controls autoPlay src={objectUrl} className={className} />;
  }

  return (
    <div className={className}>
      <button
        onClick={load}
        disabled={state === "loading"}
        className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink cp-transition hover:border-line-strong disabled:opacity-60"
      >
        {state === "loading" ? <Loader2 className="size-3.5 animate-spin" /> : <Volume2 className="size-3.5" />}
        {state === "loading" ? "Generating audio…" : "Play"}
      </button>
      {state === "error" ? (
        <p className="mt-1.5 text-[11px] text-status-flag">
          {message ?? "Couldn't load the audio. Try again in a moment."}
        </p>
      ) : null}
    </div>
  );
}

import type { NextConfig } from "next";

/**
 * The browser only ever calls same-origin `/api/...`. How that reaches the
 * FastAPI backend depends on where we're running:
 *
 *  • Local dev — `next dev` proxies `/api/*` to BACKEND_URL
 *    (default http://127.0.0.1:8000, where `uvicorn main:app` runs).
 *
 *  • Frontend on Vercel + backend on Render (recommended) — set BACKEND_URL in
 *    the Vercel project to the Render service URL; this rewrite proxies to it.
 *    The backend needs a persistent process because state is in-memory and the
 *    agent simulations run for 30–60s per request — neither fits Vercel's
 *    stateless, time-limited serverless functions, so it lives on Render.
 *
 * In every case the frontend code stays origin-agnostic — no localhost-vs-prod
 * branch anywhere in the app.
 */
// Baseline security headers. The CSP allows exactly what CallPilot uses: the
// ElevenLabs voice widget (script from unpkg, connections to elevenlabs), the
// same-origin API, and data/blob assets for the WebGL globe. 'unsafe-inline'/
// 'unsafe-eval' are required by Next's runtime + the WebGL/wasm globe; a
// production hardening step would move to per-request nonces.
const csp = [
  "default-src 'self'",
  // blob: lets the ElevenLabs voice widget load its rawAudioProcessor AudioWorklet.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://unpkg.com https://*.elevenlabs.io",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // Supabase must be here or the browser blocks every auth/database call with
  // a bare "TypeError: Failed to fetch" that looks like a Supabase outage.
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.elevenlabs.io wss://*.elevenlabs.io https://unpkg.com blob: https://*.livekit.cloud wss://*.livekit.cloud",
  "media-src 'self' blob: https://*.elevenlabs.io",
  "worker-src 'self' blob:",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Voice intake needs the mic; nothing else is allowed.
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
];

// Pin the workspace root to this app. A stray lockfile in a parent dir
// (e.g. ~/package-lock.json) otherwise makes Next infer the wrong root, which
// corrupts dev HMR/caching (phantom "parse error" overlays).
//
// Next 16 requires turbopack.root and outputFileTracingRoot to be IDENTICAL —
// setting only one fails the Vercel build with:
//   "Both outputFileTracingRoot and turbopack.root are set, but they must have
//    the same value."
// Vercel infers outputFileTracingRoot itself, so both are pinned here.
const projectRoot = __dirname;

const nextConfig: NextConfig = {
  turbopack: { root: projectRoot },
  outputFileTracingRoot: projectRoot,
  // Effects run once (like production). Avoids three.js re-initialising the
  // WebGL background on React's dev-only double-mount; lint rules still enforce
  // render purity, so nothing is lost.
  reactStrictMode: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";
    // All of /api/* proxies to FastAPI. Supabase auth does not route through
    // here — the browser talks to Supabase directly — so no carve-out is needed.
    return [{ source: "/api/:path*", destination: `${backendUrl}/:path*` }];
  },
};

export default nextConfig;

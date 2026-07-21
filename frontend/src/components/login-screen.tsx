"use client";

import { useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { signIn } from "next-auth/react";
import { PhoneCall, ArrowRight } from "lucide-react";
import { Globe } from "@/components/ui/globe";
import { ThemeToggle } from "@/components/theme-toggle";
import { AmbientBlob, Stagger, StaggerItem } from "@/components/ui/motion";

/**
 * Entry screen — an entry gate, not authentication (CallPilot has no accounts).
 * The button simply enters the demo; nothing is collected or stored. Cinematic
 * treatment: drifting ambient light blobs, a frosted-glass panel that blurs
 * into focus, a staggered content reveal, and a spring-press CTA.
 */
export function LoginScreen({ onEnter }: { onEnter: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [glow, setGlow] = useState({ x: -400, y: -400, on: false });
  const reduce = useReducedMotion();

  function onMove(e: React.MouseEvent) {
    const r = panelRef.current?.getBoundingClientRect();
    if (!r) return;
    setGlow({ x: e.clientX - r.left, y: e.clientY - r.top, on: true });
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-transparent p-4 text-ink">
      {/* drifting ambient light blobs */}
      <AmbientBlob
        duration={16}
        className="pointer-events-none absolute -left-40 -top-40 size-[36rem] rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--action)_22%,transparent),transparent_65%)] blur-3xl"
      />
      <AmbientBlob
        duration={21}
        className="pointer-events-none absolute -bottom-52 -right-32 size-[40rem] rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.16),transparent_65%)] blur-3xl"
      />

      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 24, scale: 0.97, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative grid w-full max-w-4xl overflow-hidden rounded-2xl border border-line/70 bg-paper-raised/60 shadow-2xl backdrop-blur-xl md:grid-cols-2"
      >
        {/* left: brand + entry */}
        <div
          ref={panelRef}
          onMouseMove={onMove}
          onMouseLeave={() => setGlow((g) => ({ ...g, on: false }))}
          className="relative flex flex-col items-center justify-center gap-8 px-8 py-16 sm:px-12"
        >
          <div
            className="pointer-events-none absolute size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--action)_16%,transparent),transparent_70%)] blur-2xl transition-opacity duration-200"
            style={{ left: glow.x - 144, top: glow.y - 144, opacity: glow.on ? 1 : 0 }}
          />
          <Stagger gap={0.11} delay={0.35} className="relative flex flex-col items-center gap-8">
            <StaggerItem className="flex items-center gap-2.5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-action text-action-foreground shadow-lg shadow-action/30">
                <PhoneCall className="size-5" />
              </div>
              <span className="bg-gradient-to-r from-action via-[#a855f7] to-[#ec4899] bg-clip-text font-serif text-2xl font-semibold tracking-tight text-transparent">
                CallPilot
              </span>
            </StaggerItem>
            <StaggerItem>
              <p className="max-w-xs text-center text-sm leading-relaxed text-ink-muted">
                Voice agents that call the market, compare itemized quotes, and haggle with real leverage.
              </p>
            </StaggerItem>
            <StaggerItem className="flex w-full max-w-xs flex-col gap-3">
              <motion.button
                onClick={() => signIn("google", { callbackUrl: "/" })}
                whileHover={reduce ? undefined : { scale: 1.02 }}
                whileTap={reduce ? undefined : { scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                className="inline-flex h-11 cursor-pointer items-center justify-center gap-2.5 rounded-lg bg-white px-4 text-sm font-medium text-gray-900 shadow-lg"
              >
                <GoogleIcon />
                Continue with Google
              </motion.button>
              <motion.button
                onClick={onEnter}
                whileHover={reduce ? undefined : { scale: 1.02 }}
                whileTap={reduce ? undefined : { scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                className="group inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-action px-4 text-sm font-medium text-action-foreground shadow-lg shadow-action/25"
              >
                Continue as guest
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </motion.button>
              <p className="text-center text-[11px] text-ink-muted">
                Sign in for a personalised session — or skip straight into the demo.
              </p>
            </StaggerItem>
          </Stagger>
        </div>

        {/* right: the globe — "one agent, the whole market" */}
        <div className="relative hidden items-center justify-center border-l border-line/60 bg-[radial-gradient(circle_at_50%_40%,color-mix(in_srgb,var(--action)_10%,transparent),transparent_70%)] md:flex">
          <div className="w-[78%]">
            <Globe />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="size-4" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.389-7.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.389-7.917z"
      />
    </svg>
  );
}

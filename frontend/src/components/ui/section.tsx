"use client";

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The shared editorial section header used by every stage: a gradient eyebrow,
 * a tight-tracked display headline with an optional italic serif accent word,
 * a subtitle, and optional right-aligned actions.
 */
export function SectionHeader({
  eyebrow,
  title,
  accent,
  subtitle,
  right,
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  accent?: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="animate-fade-up">
        <p className="cp-eyebrow">{eyebrow}</p>
        <h1 className="cp-display mt-2.5 text-[2.1rem] text-ink sm:text-[2.9rem]">
          {title}
          {accent ? (
            <>
              {" "}
              <span className="font-editorial font-normal italic tracking-[-0.01em]">{accent}</span>
            </>
          ) : null}
        </h1>
        {subtitle ? (
          <p className="mt-3.5 max-w-xl text-[0.95rem] leading-relaxed text-ink-muted">{subtitle}</p>
        ) : null}
      </div>
      {right ? <div className="animate-fade-up delay-2 shrink-0">{right}</div> : null}
    </header>
  );
}

/**
 * Pill CTA with a trailing arrow in a contrast circle (the Halo/Convix pattern).
 */
export function PillButton({
  children,
  onClick,
  disabled,
  type = "button",
  variant = "solid",
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  variant?: "solid" | "glass";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group inline-flex items-center gap-3 rounded-full py-1.5 pl-6 pr-1.5 text-sm font-medium",
        "transition-[background-color,transform] duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
        variant === "solid"
          ? "bg-action text-action-foreground hover:bg-action-hover"
          : "liquid-glass backdrop-blur-xl text-ink hover:brightness-110",
        className
      )}
    >
      {children}
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full transition-transform duration-200 group-hover:translate-x-0.5",
          variant === "solid" ? "bg-white" : "bg-ink/10"
        )}
      >
        <ArrowRight className={cn("size-4", variant === "solid" ? "text-black" : "text-ink")} />
      </span>
    </button>
  );
}

/**
 * Soft radial "bento" tile — the gradient card treatment from the reference set.
 * `tone` picks the wash; content is laid out top-title / bottom-body.
 */
export function BentoTile({
  tone = "amber",
  className,
  children,
}: {
  tone?: "amber" | "violet" | "rose" | "plain";
  className?: string;
  children: ReactNode;
}) {
  const wash: Record<string, string> = {
    amber: "radial-gradient(circle at 50% 0%, rgba(255,179,71,0.30) 0%, rgba(249,237,150,0.16) 32%, transparent 62%)",
    violet: "radial-gradient(circle at 50% 0%, rgba(229,161,245,0.30) 0%, rgba(248,172,160,0.16) 32%, transparent 62%)",
    rose: "radial-gradient(circle at 50% 0%, rgba(249,237,150,0.28) 0%, rgba(229,161,245,0.18) 32%, transparent 62%)",
    plain: "none",
  };
  return (
    <div className={cn("liquid-glass backdrop-blur-xl rounded-2xl p-6", className)}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: wash[tone] }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

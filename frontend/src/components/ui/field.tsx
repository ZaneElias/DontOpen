"use client";

import { useRef, useState, type ReactNode } from "react";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * A raised-glass field wrapper with a floating label. The label sits centred
 * while empty, then shrinks up into the top of the field once the control is
 * focused or filled (200ms). Depth/glow live in `.cp-field` (globals.css).
 *
 * `filled` drives the floated state for controls where CSS :placeholder-shown
 * can't (selects, date inputs, textareas we control).
 */
export function FloatingField({
  label,
  filled,
  required,
  badge,
  className,
  children,
}: {
  label: string;
  filled?: boolean;
  required?: boolean;
  badge?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div
      className={cn("cp-field flex flex-col justify-center gap-0.5 px-3.5 py-2.5", className)}
      // Focus is tracked in React and applied inline: our CSS pipeline
      // (Lightning CSS) has been observed stripping hand-written rules, and
      // Tailwind didn't emit the group-focus-within:* variants. Inline styles
      // are the one layer nothing can silently drop.
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={() => setFocused(false)}
      style={
        focused
          ? {
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.13), 0 0 0 3px color-mix(in srgb, var(--action) 18%, transparent), 0 14px 36px -16px color-mix(in srgb, var(--action) 55%, transparent)",
            }
          : undefined
      }
    >
      {/* Label sits in normal flow above the value. An absolutely-positioned
          float-on-focus was attempted first but could not be made reliable in
          this stack: Tailwind never emitted the group-focus-within:* variants,
          custom rules get dropped before reaching the CSSOM, and a nested
          motion component is captured by the parent Stagger variant tree.
          This reads the same and always renders. */}
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[0.67rem] font-medium tracking-[0.02em] transition-colors duration-200"
          style={{ color: focused ? "var(--action)" : "var(--ink-muted)" }}
        >
          {label}
          {required ? <span className="ml-0.5 text-status-flag">*</span> : null}
        </span>
        {badge}
      </div>
      {children}
    </div>
  );
}

/**
 * Custom checkbox replacing the OS default: a rounded glass tile whose
 * check-mark draws itself in via pathLength.
 */
export function AnimatedCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  const reduce = useReducedMotion();
  return (
    <label className="group flex cursor-pointer select-none items-center gap-2.5 text-sm text-ink">
      <span className="relative inline-flex">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer absolute size-0 opacity-0"
        />
        <motion.span
          aria-hidden="true"
          animate={{
            backgroundColor: checked ? "var(--action)" : "rgba(125,125,125,0.10)",
            scale: checked ? 1 : 0.97,
          }}
          transition={{ duration: reduce ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "flex size-[1.15rem] items-center justify-center rounded-[0.42rem]",
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] ring-1 ring-inset",
            checked ? "ring-transparent" : "ring-line-strong/70",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-action"
          )}
        >
          <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
            <motion.path
              d="M4 12.5 L9.5 18 L20 6.5"
              initial={false}
              animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
              transition={{ duration: reduce ? 0 : 0.25, ease: [0.16, 1, 0.3, 1] }}
            />
          </svg>
        </motion.span>
      </span>
      <span className="transition-colors duration-200 group-hover:text-ink">{label}</span>
    </label>
  );
}

/**
 * Subtle 3D tilt toward the cursor (rotateX/rotateY, springed).
 *
 * NOTE: this applies a `transform`, which makes the element a containing block
 * AND a new backdrop root — so descendants relying on `backdrop-filter` lose
 * their blur. That's why the fields inside use an opaque-ish translucent fill
 * (.cp-field) rather than backdrop-blur.
 */
export function TiltCard({
  children,
  className,
  max = 4,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const spring = { stiffness: 150, damping: 18, mass: 0.6 };
  const rotateX = useSpring(useTransform(py, [0, 1], [max, -max]), spring);
  const rotateY = useSpring(useTransform(px, [0, 1], [-max, max]), spring);

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <div style={{ perspective: 1200 }}>
      <motion.div
        ref={ref}
        onMouseMove={(e) => {
          const r = ref.current?.getBoundingClientRect();
          if (!r) return;
          px.set((e.clientX - r.left) / r.width);
          py.set((e.clientY - r.top) / r.height);
        }}
        onMouseLeave={() => {
          px.set(0.5);
          py.set(0.5);
        }}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className={className}
      >
        {children}
      </motion.div>
    </div>
  );
}

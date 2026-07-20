"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

// Expo.out — the cinematic "settle" easing the design system calls for.
export const EASE_CINEMATIC = [0.16, 1, 0.3, 1] as const;

/**
 * Rises + fades into view once. Used for hero moments and section reveals.
 * Fully static under prefers-reduced-motion.
 */
export function Reveal({
  children,
  delay = 0,
  y = 18,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-8% 0px" }}
      transition={{ duration: 0.6, ease: EASE_CINEMATIC, delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Container that cascades its <StaggerItem> children in sequence on mount.
 */
export function Stagger({
  children,
  className,
  gap = 0.08,
  delay = 0.04,
}: {
  children: ReactNode;
  className?: string;
  gap?: number;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: gap, delayChildren: delay } } }}
    >
      {children}
    </motion.div>
  );
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE_CINEMATIC } },
};

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
}

/**
 * A soft, slowly-drifting ambient light blob — the "atmospheric" layer from the
 * Modern Dark style. Pointer-events-none; sits behind content.
 */
export function AmbientBlob({
  className,
  duration = 14,
}: {
  className?: string;
  duration?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className} aria-hidden="true" />;
  return (
    <motion.div
      aria-hidden="true"
      className={className}
      initial={{ opacity: 0.5, scale: 1 }}
      animate={{ opacity: [0.4, 0.75, 0.4], scale: [1, 1.12, 1], x: [0, 18, 0], y: [0, -14, 0] }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

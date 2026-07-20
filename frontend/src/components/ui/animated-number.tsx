"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";

/**
 * Counts from the previous value up to `value` on change. Used for money
 * figures on the report so the final numbers land with a bit of weight instead
 * of just appearing. Respects prefers-reduced-motion.
 */
export function AnimatedNumber({
  value,
  format = (n) => String(Math.round(n)),
  durationMs = 900,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  durationMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);
  const reduce = useReducedMotion();
  const [initial] = useState(() => format(0));

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduce) {
      node.textContent = format(value);
      prev.current = value;
      return;
    }
    const controls = animate(prev.current, value, {
      duration: durationMs / 1000,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        node.textContent = format(v);
      },
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, format, durationMs, reduce]);

  return (
    <span ref={ref} className={className}>
      {initial}
    </span>
  );
}

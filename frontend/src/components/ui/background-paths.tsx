"use client";

import { motion } from "framer-motion";

function FloatingPaths({ position }: { position: number }) {
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${189 + i * 6} -${
      312 - i * 5 * position
    } ${216 - i * 6} ${152 - i * 5 * position} ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
      684 - i * 5 * position
    } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    width: 0.5 + i * 0.03,
  }));

  return (
    <svg className="h-full w-full text-slate-950 dark:text-white" viewBox="0 0 696 316" fill="none">
      {paths.map((path) => (
        <motion.path
          key={path.id}
          d={path.d}
          stroke="currentColor"
          strokeWidth={path.width}
          strokeOpacity={0.06 + path.id * 0.012}
          initial={{ pathLength: 0.3, opacity: 0.5 }}
          animate={{ pathLength: 1, opacity: [0.2, 0.45, 0.2], pathOffset: [0, 1, 0] }}
          transition={{ duration: 20 + (path.id % 10), repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
        />
      ))}
    </svg>
  );
}

/**
 * Ambient animated line background — fixed behind all content, non-interactive.
 * Subtle white strokes on the dark theme; the app's surfaces sit on top.
 */
export function BackgroundPaths() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <FloatingPaths position={1} />
      <FloatingPaths position={-1} />
    </div>
  );
}

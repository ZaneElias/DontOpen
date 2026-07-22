"use client";

import { useEffect, useRef } from "react";
import createGlobe from "cobe";

type LatLng = [number, number];

/**
 * Decorative auto-rotating globe (cobe) themed to CallPilot's warm-paper /
 * blue palette. Purely presentational; no interaction, so it stays cheap and
 * robust.
 *
 * Markers default to none — the blue dots read as real data rather than
 * decoration, which they aren't. Callers can still pass their own if a genuine
 * set of locations ever needs plotting.
 */
export function Globe({
  className = "",
  markers = [],
}: {
  className?: string;
  markers?: LatLng[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let phi = 0;
    let width = 0;
    let globe: ReturnType<typeof createGlobe> | null = null;
    let raf = 0;

    const start = () => {
      width = canvas.offsetWidth;
      if (!width || globe) return; // wait until laid out
      globe = createGlobe(canvas, {
        devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        width: width * 2,
        height: width * 2,
        phi: 0,
        theta: 0.25,
        dark: 0,
        diffuse: 1.2,
        mapSamples: 16000,
        mapBrightness: 8,
        baseColor: [0.96, 0.94, 0.9], // warm paper
        markerColor: [0.145, 0.333, 0.78], // action blue
        glowColor: [0.97, 0.95, 0.92],
        markers: markers.map((location) => ({ location, size: 0.05 })),
      });
      // cobe v2 renders via an external rAF loop calling update().
      const tick = () => {
        phi += 0.004;
        globe!.update({ phi, width: width * 2, height: width * 2 });
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    const ro = new ResizeObserver(() => {
      if (!globe) start();
      else width = canvas.offsetWidth;
    });
    ro.observe(canvas);
    start();

    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      globe?.destroy();
    };
  }, [markers]);

  return (
    <div className={`relative aspect-square w-full max-w-[420px] ${className}`}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}

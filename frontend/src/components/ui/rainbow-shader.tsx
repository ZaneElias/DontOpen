"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Animated rainbow WebGL background (fixed, non-interactive). Rendered dimmed
 * with a dark overlay on top so the app's content stays readable while the
 * colour sweeps behind everything.
 */
export function RainbowShader() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const vertexShader = `
      attribute vec3 position;
      void main() { gl_Position = vec4(position, 1.0); }
    `;
    const fragmentShader = `
      precision highp float;
      uniform vec2 resolution;
      uniform float time;
      uniform float xScale;
      uniform float yScale;
      uniform float distortion;
      void main() {
        vec2 p = (gl_FragCoord.xy * 2.0 - resolution) / min(resolution.x, resolution.y);
        float d = length(p) * distortion;
        float rx = p.x * (1.0 + d);
        float gx = p.x;
        float bx = p.x * (1.0 - d);
        float r = 0.06 / abs(p.y + sin((rx + time) * xScale) * yScale);
        float g = 0.06 / abs(p.y + sin((gx + time) * xScale) * yScale);
        float b = 0.06 / abs(p.y + sin((bx + time) * xScale) * yScale);
        gl_FragColor = vec4(r, g, b, 1.0);
      }
    `;

    // Let three create its own canvas each mount — reusing a canvas across
    // React's dev double-mount throws "canvas has an existing context".
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(new THREE.Color(0x05070d));
    const el = renderer.domElement;
    el.style.width = "100%";
    el.style.height = "100%";
    el.style.display = "block";
    container.appendChild(el);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, -1);
    const uniforms = {
      resolution: { value: [window.innerWidth, window.innerHeight] },
      time: { value: 0.0 },
      xScale: { value: 1.0 },
      yScale: { value: 0.5 },
      distortion: { value: 0.05 },
    };
    const positions = new THREE.BufferAttribute(
      new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]),
      3
    );
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", positions);
    const material = new THREE.RawShaderMaterial({ vertexShader, fragmentShader, uniforms, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h, false);
      uniforms.resolution.value = [w, h];
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    const animate = () => {
      uniforms.time.value += 0.008;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      el.remove();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div ref={containerRef} className="h-full w-full opacity-90" />
      {/* dark veil so text stays readable over the bright rainbow */}
      <div className="absolute inset-0 bg-[#05070d]/35" />
    </div>
  );
}

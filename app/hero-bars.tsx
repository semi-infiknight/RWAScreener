"use client";

import { useEffect, useRef } from "react";

/**
 * Interactive hero bars inspired by Base ecosystem canvas.
 * Original implementation: traveling wave packets + pointer Gaussian lift.
 */

type Packet = {
  /** center x as fraction of width */
  x: number;
  /** center y as fraction of height */
  y: number;
  /** horizontal speed (width-fractions / sec) */
  vx: number;
  /** peak height px */
  peak: number;
  /** half-width in bar indices */
  sigma: number;
  /** opacity */
  alpha: number;
  /** phase for idle pulse */
  phase: number;
};

export function HeroBars() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const BAR_W = 9;
    const GAP = 7;
    const STEP = BAR_W + GAP;

    const pointer = { x: 0, y: 0, active: false, tx: 0, ty: 0 };
    let raf = 0;
    let last = performance.now();
    let w = 0;
    let h = 0;

    const packets: Packet[] = [
      { x: 0.55, y: 0.42, vx: 0.045, peak: 110, sigma: 5.5, alpha: 0.9, phase: 0 },
      { x: 0.22, y: 0.38, vx: 0.028, peak: 58, sigma: 4.2, alpha: 0.35, phase: 1.7 },
      { x: 0.78, y: 0.48, vx: -0.022, peak: 48, sigma: 3.8, alpha: 0.28, phase: 3.1 },
    ];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = wrap.getBoundingClientRect();
      w = Math.max(320, rect.width);
      h = Math.max(260, rect.height);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const smoothPointer = (dt: number) => {
      const k = 1 - Math.exp(-dt * 10);
      pointer.tx += (pointer.x - pointer.tx) * k;
      pointer.ty += (pointer.y - pointer.ty) * k;
    };

    const barColor = (relH: number, accent: number) => {
      // relH 0 bottom → 1 top tip; accent shifts pastel tip hue
      const bottom = { r: 140, g: 150, b: 255 };
      const mid = { r: 180, g: 170, b: 245 };
      const tips = [
        { r: 210, g: 235, b: 170 }, // pale lime
        { r: 255, g: 230, b: 190 }, // pale yellow
        { r: 255, g: 200, b: 220 }, // pale pink
      ];
      const tip = tips[accent % tips.length];
      const t = Math.min(1, Math.max(0, relH));
      let r: number, g: number, b: number;
      if (t < 0.55) {
        const u = t / 0.55;
        r = bottom.r + (mid.r - bottom.r) * u;
        g = bottom.g + (mid.g - bottom.g) * u;
        b = bottom.b + (mid.b - bottom.b) * u;
      } else {
        const u = (t - 0.55) / 0.45;
        r = mid.r + (tip.r - mid.r) * u;
        g = mid.g + (tip.g - mid.g) * u;
        b = mid.b + (tip.b - mid.b) * u;
      }
      return `rgb(${r | 0},${g | 0},${b | 0})`;
    };

    const drawBar = (
      x: number,
      baseline: number,
      height: number,
      alpha: number,
      accent: number,
    ) => {
      if (height < 1.5 || alpha < 0.02) return;
      const top = baseline - height;
      const grad = ctx.createLinearGradient(x, baseline, x, top);
      grad.addColorStop(0, barColor(0, accent));
      grad.addColorStop(0.5, barColor(0.45, accent));
      grad.addColorStop(1, barColor(1, accent));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = grad;
      const left = x - BAR_W / 2;
      if (typeof ctx.roundRect === "function") {
        ctx.beginPath();
        ctx.roundRect(left, top, BAR_W, height, [3, 3, 2, 2]);
        ctx.fill();
      } else {
        ctx.fillRect(left, top, BAR_W, height);
      }
    };

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;

      smoothPointer(dt);
      ctx.clearRect(0, 0, w, h);

      // advance traveling packets
      for (const p of packets) {
        p.x += p.vx * dt;
        if (p.x > 1.25) p.x = -0.2;
        if (p.x < -0.25) p.x = 1.2;
      }

      const cols = Math.ceil(w / STEP) + 2;
      const heights = new Float32Array(cols);
      const alphas = new Float32Array(cols);
      const accents = new Int8Array(cols);

      for (let i = 0; i < cols; i++) {
        const x = i * STEP + BAR_W / 2;
        let hSum = 0;
        let aSum = 0;

        for (const p of packets) {
          const cx = p.x * w;
          const cy = p.y * h;
          const di = (x - cx) / STEP;
          const env = Math.exp(-(di * di) / (2 * p.sigma * p.sigma));
          const pulse =
            0.85 + 0.15 * Math.sin(t * 1.6 + p.phase + di * 0.35);
          const amp = p.peak * env * pulse;
          hSum += amp;
          aSum += p.alpha * env;
        }

        // pointer Gaussian lift — follows cursor, taller when pointer higher
        if (pointer.active) {
          const dx = (x - pointer.tx) / (STEP * 4.2);
          const dyNorm = 1 - Math.min(1, Math.max(0, pointer.ty / h));
          const vert = 0.55 + dyNorm * 0.9;
          const g = Math.exp(-(dx * dx));
          hSum += 130 * g * vert;
          aSum += 0.95 * g;
        }

        // faint global idle shimmer so empty areas aren't dead
        hSum +=
          6 *
          (0.5 +
            0.5 *
              Math.sin(t * 0.9 + i * 0.22) *
              Math.sin(t * 0.35 + i * 0.05));

        heights[i] = hSum;
        alphas[i] = Math.min(0.95, aSum);
        accents[i] = i % 3;
      }

      // soft trail: draw a faded offset pass first
      for (let i = 0; i < cols; i++) {
        const x = i * STEP + BAR_W / 2;
        const baseline = h * 0.58;
        drawBar(
          x + 10,
          baseline + 8,
          heights[i] * 0.55,
          alphas[i] * 0.22,
          accents[i],
        );
      }

      for (let i = 0; i < cols; i++) {
        const x = i * STEP + BAR_W / 2;
        const baseline = h * 0.58;
        drawBar(x, baseline, heights[i], alphas[i], accents[i]);
      }

      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = true;
    };
    const onLeave = () => {
      pointer.active = false;
    };

    resize();
    raf = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerleave", onLeave);
    wrap.addEventListener("pointerdown", onMove);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerleave", onLeave);
      wrap.removeEventListener("pointerdown", onMove);
    };
  }, []);

  return (
    <div className="hero-canvas-wrap" ref={wrapRef} aria-hidden>
      <canvas ref={canvasRef} />
    </div>
  );
}

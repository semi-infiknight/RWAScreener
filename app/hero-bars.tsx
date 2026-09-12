"use client";

import { useEffect, useRef } from "react";

/**
 * Base-inspired hero: sparse pastel vertical-bar clusters on canvas.
 * Clusters drift/re-form and can read as fleeting wing-like arcs.
 * Original implementation (no Base assets).
 */

type Cluster = {
  x: number; // normalized 0..1
  y: number; // normalized baseline
  vx: number;
  age: number;
  maxAge: number;
  life: number;
  peak: number;
  bars: number;
  sigma: number;
  /** per-bar vertical jitter seeds */
  offsets: number[];
  heights: number[];
  hues: number[];
  /** morph phase for wing/hump shapes */
  morph: number;
};

function makeCluster(seed?: Partial<Cluster>): Cluster {
  const bars = 12 + Math.floor(Math.random() * 8); // 12–19
  const fromLeft = Math.random() > 0.45;
  return {
    x: fromLeft ? -0.05 + Math.random() * 0.15 : 0.85 + Math.random() * 0.2,
    y: 0.36 + Math.random() * 0.16,
    vx: (fromLeft ? 1 : -1) * (0.035 + Math.random() * 0.04),
    age: 0,
    maxAge: 6.5 + Math.random() * 5,
    life: 0,
    peak: 55 + Math.random() * 50,
    bars,
    sigma: 3.4 + Math.random() * 2.2,
    offsets: Array.from({ length: bars }, () => (Math.random() - 0.5) * 18),
    heights: Array.from({ length: bars }, () => 0.55 + Math.random() * 0.55),
    hues: Array.from({ length: bars }, (_, i) => i % 3),
    morph: Math.random() * Math.PI * 2,
    ...seed,
  };
}

export function HeroBars() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const BAR_W = 8.5;
    const GAP = 5.5;
    const STEP = BAR_W + GAP;

    let w = 0;
    let h = 0;
    let raf = 0;
    let last = performance.now();
    let spawnAt = 0.8;

    const clusters: Cluster[] = [
      makeCluster({
        x: 0.58,
        y: 0.38,
        vx: 0.028,
        peak: 95,
        bars: 16,
        life: 1,
        age: 1.2,
        maxAge: 11,
      }),
      makeCluster({
        x: 0.3,
        y: 0.48,
        vx: -0.02,
        peak: 42,
        bars: 11,
        life: 0.6,
        age: 3,
        maxAge: 8,
      }),
    ];

    // lagged pointer attractor
    const pointer = {
      x: 0.5,
      y: 0.4,
      tx: 0.5,
      ty: 0.4,
      active: false,
      strength: 0,
    };

    const colors = {
      base: [
        [138, 148, 255],
        [160, 150, 245],
        [175, 165, 250],
      ],
      tip: [
        [210, 235, 165],
        [255, 228, 185],
        [255, 200, 215],
      ],
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = wrap.getBoundingClientRect();
      w = Math.max(320, rect.width);
      h = Math.max(300, rect.height);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const shapeAt = (c: Cluster, i: number, t: number) => {
      const half = (c.bars - 1) / 2;
      const di = i - half;
      // Gaussian hump
      let env = Math.exp(-(di * di) / (2 * c.sigma * c.sigma));
      // transient wing/arc morph: lift outer lobes
      const wing =
        0.55 +
        0.45 *
          Math.abs(Math.sin((di / (half || 1)) * Math.PI)) *
          (0.6 + 0.4 * Math.sin(t * 1.4 + c.morph));
      // occasional valley in center for “two wing” read
      const split =
        1 -
        0.22 *
          Math.exp(-(di * di) / 2.2) *
          (0.5 + 0.5 * Math.sin(t * 0.9 + c.morph * 0.5));
      env *= wing * split * c.heights[i];
      return env;
    };

    const drawCluster = (c: Cluster, strength: number, t: number) => {
      if (strength < 0.03) return;
      const cx = c.x * w;
      const baseline = c.y * h;
      const half = (c.bars - 1) / 2;

      for (let i = 0; i < c.bars; i++) {
        const di = i - half;
        const env = shapeAt(c, i, t);
        const height = c.peak * env * strength;
        if (height < 1.5) continue;

        const x = cx + di * STEP;
        const yOff = c.offsets[i] * (0.6 + 0.4 * Math.sin(t + i));
        const bottom = baseline + yOff;
        const top = bottom - height;

        const tip = colors.tip[c.hues[i] % 3];
        const base = colors.base[c.hues[i] % 3];
        const a = Math.min(0.92, (0.2 + env) * strength);

        const grad = ctx.createLinearGradient(x, bottom, x, top);
        grad.addColorStop(0, `rgba(${base[0]},${base[1]},${base[2]},${a * 0.95})`);
        grad.addColorStop(
          0.55,
          `rgba(${base[0]},${base[1]},${base[2]},${a * 0.75})`,
        );
        grad.addColorStop(1, `rgba(${tip[0]},${tip[1]},${tip[2]},${a * 0.7})`);

        // faint afterimage under the bar
        ctx.globalAlpha = a * 0.18;
        ctx.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
        ctx.fillRect(x - BAR_W / 2, bottom, BAR_W, Math.min(28, height * 0.35));

        ctx.globalAlpha = 1;
        ctx.fillStyle = grad;
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(x - BAR_W / 2, top, BAR_W, height, [2.5, 2.5, 1.5, 1.5]);
        } else {
          ctx.rect(x - BAR_W / 2, top, BAR_W, height);
        }
        ctx.fill();
      }
    };

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;

      // laggy pointer
      const pk = 1 - Math.exp(-dt * 3.5);
      pointer.x += (pointer.tx - pointer.x) * pk;
      pointer.y += (pointer.ty - pointer.y) * pk;
      const want = pointer.active ? 1 : 0;
      pointer.strength += (want - pointer.strength) * (1 - Math.exp(-dt * 4));

      ctx.clearRect(0, 0, w, h);

      spawnAt -= dt;
      if (spawnAt <= 0 && clusters.length < 3) {
        clusters.push(makeCluster());
        spawnAt = 1.8 + Math.random() * 2.5;
      }

      for (let i = clusters.length - 1; i >= 0; i--) {
        const c = clusters[i];
        c.age += dt;
        c.x += c.vx * dt;
        c.morph += dt * 0.7;
        // gentle bob
        c.y += Math.sin(t * 1.1 + c.morph) * 0.0008;

        // gently attract strongest cluster toward pointer region
        if (pointer.strength > 0.05 && i === 0) {
          c.x += (pointer.x - c.x) * dt * 0.55 * pointer.strength;
          c.y += (pointer.y - c.y) * dt * 0.45 * pointer.strength;
          c.peak += (100 - c.peak) * dt * 0.8 * pointer.strength;
        }

        const u = c.age / c.maxAge;
        if (u < 0.12) c.life = u / 0.12;
        else if (u > 0.72) c.life = Math.max(0, (1 - u) / 0.28);
        else c.life = 1;

        const pulse = 0.92 + 0.08 * Math.sin(t * 2.1 + c.morph);
        drawCluster(c, c.life * pulse, t);

        if (c.age > c.maxAge || c.x < -0.3 || c.x > 1.3) clusters.splice(i, 1);
      }

      // pointer-local ephemeral cluster (builds near cursor with lag)
      if (pointer.strength > 0.04) {
        const local = makeCluster({
          x: pointer.x,
          y: pointer.y,
          vx: 0,
          peak: 70 + (1 - pointer.y) * 45,
          bars: 14,
          sigma: 4.2,
          life: 1,
          age: 1,
          maxAge: 2,
          offsets: Array.from({ length: 14 }, () => (Math.random() - 0.5) * 10),
          heights: Array.from({ length: 14 }, () => 0.7 + Math.random() * 0.4),
          hues: Array.from({ length: 14 }, (_, i) => i % 3),
          morph: t * 2,
        });
        drawCluster(local, pointer.strength * 0.95, t);
        // faint lagged ghost
        local.x -= 0.04;
        local.peak *= 0.55;
        drawCluster(local, pointer.strength * 0.28, t + 1);
      }

      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.tx = (e.clientX - rect.left) / Math.max(1, rect.width);
      pointer.ty = (e.clientY - rect.top) / Math.max(1, rect.height);
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

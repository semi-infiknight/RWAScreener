"use client";

import { useEffect, useRef } from "react";

/**
 * Dark Meteora-coded hero: sharp ember/orange energy columns.
 * Sparse drifting clusters + laggy pointer — no cute wing morph.
 */

type Cluster = {
  x: number;
  y: number;
  vx: number;
  age: number;
  maxAge: number;
  life: number;
  peak: number;
  bars: number;
  sigma: number;
  offsets: number[];
  heights: number[];
  tones: number[];
};

function makeCluster(seed?: Partial<Cluster>): Cluster {
  const bars = 11 + Math.floor(Math.random() * 7);
  const fromLeft = Math.random() > 0.45;
  return {
    x: fromLeft ? -0.04 + Math.random() * 0.12 : 0.88 + Math.random() * 0.16,
    y: 0.4 + Math.random() * 0.12,
    vx: (fromLeft ? 1 : -1) * (0.04 + Math.random() * 0.035),
    age: 0,
    maxAge: 5.5 + Math.random() * 4,
    life: 0,
    peak: 60 + Math.random() * 45,
    bars,
    sigma: 2.8 + Math.random() * 1.6,
    offsets: Array.from({ length: bars }, () => (Math.random() - 0.5) * 8),
    heights: Array.from({ length: bars }, () => 0.65 + Math.random() * 0.4),
    tones: Array.from({ length: bars }, (_, i) => i % 3),
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

    const BAR_W = 7;
    const GAP = 4;
    const STEP = BAR_W + GAP;

    let w = 0;
    let h = 0;
    let raf = 0;
    let last = performance.now();
    let spawnAt = 0.6;

    const clusters: Cluster[] = [
      makeCluster({
        x: 0.56,
        y: 0.4,
        vx: 0.03,
        peak: 88,
        bars: 14,
        life: 1,
        age: 1,
        maxAge: 9,
      }),
    ];

    const pointer = {
      x: 0.5,
      y: 0.42,
      tx: 0.5,
      ty: 0.42,
      active: false,
      strength: 0,
    };

    const tones = [
      { base: [255, 90, 0], tip: [255, 200, 90] },
      { base: [255, 120, 20], tip: [255, 230, 140] },
      { base: [220, 70, 0], tip: [255, 170, 70] },
    ];

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

    const drawCluster = (c: Cluster, strength: number, t: number) => {
      if (strength < 0.04) return;
      const cx = c.x * w;
      const baseline = c.y * h;
      const half = (c.bars - 1) / 2;

      for (let i = 0; i < c.bars; i++) {
        const di = i - half;
        const env =
          Math.exp(-(di * di) / (2 * c.sigma * c.sigma)) * c.heights[i];
        const flicker = 0.92 + 0.08 * Math.sin(t * 8 + i * 0.7);
        const height = c.peak * env * strength * flicker;
        if (height < 2) continue;

        const x = cx + di * STEP;
        const bottom = baseline + c.offsets[i];
        const top = bottom - height;
        const tone = tones[c.tones[i] % 3];
        const a = Math.min(0.95, 0.25 + env * strength);

        const grad = ctx.createLinearGradient(x, bottom, x, top);
        grad.addColorStop(
          0,
          `rgba(${tone.base[0]},${tone.base[1]},${tone.base[2]},${a})`,
        );
        grad.addColorStop(
          0.65,
          `rgba(${tone.base[0]},${Math.min(255, tone.base[1] + 40)},${tone.base[2]},${a * 0.9})`,
        );
        grad.addColorStop(
          1,
          `rgba(${tone.tip[0]},${tone.tip[1]},${tone.tip[2]},${a * 0.85})`,
        );

        ctx.shadowColor = `rgba(255, 106, 0, ${0.25 * a})`;
        ctx.shadowBlur = 8;
        ctx.fillStyle = grad;
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(x - BAR_W / 2, top, BAR_W, height, [1.5, 1.5, 1, 1]);
        } else {
          ctx.rect(x - BAR_W / 2, top, BAR_W, height);
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    };

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;

      const pk = 1 - Math.exp(-dt * 4);
      pointer.x += (pointer.tx - pointer.x) * pk;
      pointer.y += (pointer.ty - pointer.y) * pk;
      pointer.strength +=
        ((pointer.active ? 1 : 0) - pointer.strength) *
        (1 - Math.exp(-dt * 5));

      ctx.clearRect(0, 0, w, h);

      spawnAt -= dt;
      if (spawnAt <= 0 && clusters.length < 2) {
        clusters.push(makeCluster());
        spawnAt = 2 + Math.random() * 2.5;
      }

      for (let i = clusters.length - 1; i >= 0; i--) {
        const c = clusters[i];
        c.age += dt;
        c.x += c.vx * dt;

        if (pointer.strength > 0.05 && i === 0) {
          c.x += (pointer.x - c.x) * dt * 0.7 * pointer.strength;
          c.y += (pointer.y - c.y) * dt * 0.55 * pointer.strength;
          c.peak += (95 - c.peak) * dt * pointer.strength;
        }

        const u = c.age / c.maxAge;
        if (u < 0.1) c.life = u / 0.1;
        else if (u > 0.75) c.life = Math.max(0, (1 - u) / 0.25);
        else c.life = 1;

        drawCluster(c, c.life, t);
        if (c.age > c.maxAge || c.x < -0.25 || c.x > 1.25) clusters.splice(i, 1);
      }

      if (pointer.strength > 0.05) {
        const local = makeCluster({
          x: pointer.x,
          y: pointer.y,
          vx: 0,
          peak: 75 + (1 - pointer.y) * 40,
          bars: 13,
          sigma: 3.2,
          life: 1,
          age: 1,
          maxAge: 2,
          offsets: Array.from({ length: 13 }, () => (Math.random() - 0.5) * 6),
          heights: Array.from({ length: 13 }, () => 0.75 + Math.random() * 0.3),
          tones: Array.from({ length: 13 }, (_, i) => i % 3),
        });
        drawCluster(local, pointer.strength, t);
      }

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

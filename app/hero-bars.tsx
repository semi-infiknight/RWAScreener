"use client";

import { useEffect, useRef } from "react";

/**
 * Hero bar field tuned from Base ecosystem observations (own implementation).
 * Spec targets: 8–12 core bars / cluster, ~14–16px pitch, 1–2px corners,
 * smooth drift, fringe fade, height noise ±1–4px. Palette: Meteora orange.
 */

type Cluster = {
  xPx: number;
  y: number; // baseline as fraction of height
  vx: number; // px/s
  age: number;
  maxAge: number;
  life: number;
  n: number;
  peak: number;
  seed: number;
  phase: number;
};

const PITCH = 15; // ~14–16px
const CORE_W = 9; // ~8–10px
const RADIUS = 1.5;

function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function makeCluster(w: number, partial?: Partial<Cluster>): Cluster {
  const fromLeft = Math.random() > 0.5;
  const large = Math.random() > 0.4;
  const n = large ? 10 + Math.floor(Math.random() * 3) : 6 + Math.floor(Math.random() * 4); // 6–12 core
  return {
    xPx: fromLeft ? -40 - Math.random() * 60 : w + 40 + Math.random() * 60,
    y: 0.58 + Math.random() * 0.06,
    vx: (fromLeft ? 1 : -1) * (55 + Math.random() * 55), // 55–110 px/s
    age: 0,
    maxAge: 7 + Math.random() * 5,
    life: 0,
    n,
    peak: large ? 70 + Math.random() * 40 : 40 + Math.random() * 30, // ~28–110
    seed: Math.random() * 1000,
    phase: Math.random() * Math.PI * 2,
    ...partial,
  };
}

function envelope(u: number, seed: number, t: number, phase: number) {
  // u in [-1,1] across cluster
  const a = Math.max(0, 1 - Math.abs(u));
  const soft = a * a * (3 - 2 * a);
  const n1 = Math.sin(u * 7 + seed + t * 1.3 + phase) * 0.16;
  const n2 = Math.sin(u * 15 + seed * 1.4 - t * 0.9) * 0.08;
  const n3 = (hash(Math.floor(u * 24 + seed)) - 0.5) * 0.1;
  const core = Math.exp(-(u * u) * 2.4);
  return Math.max(0, soft * (0.55 + 0.45 * core) + n1 + n2 + n3);
}

export function HeroBars() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;
    let last = performance.now();
    let spawnAt = 1.0;

    const clusters: Cluster[] = [];

    const pointer = {
      tx: 0.5,
      ty: 0.55,
      x: 0.5,
      y: 0.55,
      active: false,
      strength: 0,
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = wrap.getBoundingClientRect();
      w = Math.max(320, rect.width);
      h = Math.max(300, Math.min(490, rect.height));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (clusters.length === 0) {
        clusters.push(
          makeCluster(w, {
            xPx: w * 0.62,
            n: 11,
            peak: 95,
            vx: 70,
            life: 1,
            age: 2,
            maxAge: 12,
            seed: 12,
          }),
          makeCluster(w, {
            xPx: w * 0.32,
            n: 8,
            peak: 52,
            vx: -60,
            life: 0.85,
            age: 3,
            maxAge: 10,
            seed: 44,
          }),
          makeCluster(w, {
            xPx: w * 0.14,
            n: 6,
            peak: 32,
            vx: 50,
            life: 0.5,
            age: 4,
            maxAge: 8,
            seed: 77,
          }),
        );
      }
    };

    const colorFor = (u: number, relH: number, a: number) => {
      const core = Math.exp(-(u * u) * 3.5);
      const edge = Math.abs(u);
      let r: number, g: number, b: number;
      if (core > 0.55) {
        const k = (core - 0.55) / 0.45;
        r = 255;
        g = Math.round(190 + 50 * k + 15 * relH);
        b = Math.round(100 + 90 * k * relH);
      } else if (edge > 0.78) {
        r = 255;
        g = Math.round(170 + 50 * relH);
        b = Math.round(40 + 25 * relH);
      } else {
        r = 255;
        g = Math.round(95 + 70 * (1 - Math.abs(u)) + 30 * relH);
        b = Math.round(10 + 20 * relH);
      }
      return `rgba(${r},${g},${b},${a})`;
    };

    const drawCluster = (c: Cluster, strength: number, t: number) => {
      if (strength < 0.04) return;
      const baseline = c.y * h;
      const half = (c.n - 1) / 2 || 1;
      const fringeExtra = 6; // pale fringe bars on each side
      const total = c.n + fringeExtra * 2;

      for (let i = 0; i < total; i++) {
        const coreIndex = i - fringeExtra;
        const u = coreIndex / half; // beyond ±1 for fringe
        const inCore = Math.abs(u) <= 1.05;
        const env = envelope(Math.max(-1.35, Math.min(1.35, u)), c.seed, t, c.phase);
        if (env < 0.02) continue;

        // ±1–4px height noise
        const noise = (hash(coreIndex * 13 + c.seed + Math.floor(t * 8)) - 0.5) * 6;
        const shimmer = Math.sin(t * 4.2 + coreIndex * 0.8 + c.phase) * 2;
        let height = c.peak * env * strength + noise + shimmer;
        height = Math.max(4, Math.min(120, height));

        const x = c.xPx + coreIndex * PITCH;
        const isFringe = !inCore || env < 0.22;
        const barW = isFringe
          ? 1.2 + hash(coreIndex + c.seed) * 1.8
          : CORE_W + (hash(coreIndex * 3 + c.seed) - 0.5) * 1.5;

        const coreA = 0.65 + 0.25 * env;
        const fringeA = 0.03 + 0.09 * env;
        const a = Math.min(0.92, (isFringe ? fringeA : coreA) * strength);

        const top = baseline - height;
        const grad = ctx.createLinearGradient(x, baseline, x, top);
        grad.addColorStop(0, colorFor(u, 0, a * 0.8));
        grad.addColorStop(0.5, colorFor(u, 0.45, a));
        grad.addColorStop(1, colorFor(u, 1, a * 0.9));

        // fringe glow only (~2–5px)
        if (isFringe) {
          ctx.shadowColor = `rgba(255, 120, 30, ${0.2 * a})`;
          ctx.shadowBlur = 3;
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        const left = x - barW / 2;
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(left, top, barW, height, RADIUS);
        } else {
          ctx.rect(left, top, barW, height);
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    };

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;

      const pk = 1 - Math.exp(-dt * 3.2);
      pointer.x += (pointer.tx - pointer.x) * pk;
      pointer.y += (pointer.ty - pointer.y) * pk;
      pointer.strength +=
        ((pointer.active ? 1 : 0) - pointer.strength) *
        (1 - Math.exp(-dt * 4));

      ctx.clearRect(0, 0, w, h);

      spawnAt -= dt;
      if (spawnAt <= 0 && clusters.length < 3) {
        clusters.push(makeCluster(w));
        spawnAt = 1.5 + Math.random() * 2.2;
      }

      const order = [...clusters.keys()].sort(
        (a, b) => clusters[a].n - clusters[b].n,
      );

      for (const idx of order) {
        const c = clusters[idx];
        c.age += dt;
        c.xPx += c.vx * dt;
        c.phase += dt * 0.4;

        if (pointer.strength > 0.05 && c.n >= 10) {
          const targetX = pointer.x * w;
          c.xPx += (targetX - c.xPx) * dt * 1.6 * pointer.strength;
          c.y += (0.55 + pointer.y * 0.08 - c.y) * dt * 0.5 * pointer.strength;
        }

        // fade in/out ~400–800ms ≈ 0.1–0.15 of life for short clusters
        const fadeIn = 0.55;
        const fadeOut = 0.65;
        const u = c.age / c.maxAge;
        if (c.age < fadeIn) c.life = c.age / fadeIn;
        else if (c.maxAge - c.age < fadeOut) c.life = Math.max(0, (c.maxAge - c.age) / fadeOut);
        else c.life = 1;

        drawCluster(c, c.life, t);
      }

      for (let i = clusters.length - 1; i >= 0; i--) {
        const c = clusters[i];
        const halfW = (c.n * PITCH) / 2 + 40;
        if (c.age > c.maxAge || c.xPx < -halfW || c.xPx > w + halfW) {
          clusters.splice(i, 1);
        }
      }

      if (pointer.strength > 0.05) {
        const local = makeCluster(w, {
          xPx: pointer.x * w,
          y: 0.56 + pointer.y * 0.06,
          vx: 0,
          n: 11,
          peak: 75 + (1 - pointer.y) * 35,
          life: 1,
          age: 1,
          maxAge: 2,
          seed: 30 + Math.floor(pointer.x * 15),
          phase: t,
        });
        drawCluster(local, pointer.strength, t);
        local.xPx -= 28;
        local.peak *= 0.55;
        local.n = 8;
        drawCluster(local, pointer.strength * 0.35, t + 0.4);
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

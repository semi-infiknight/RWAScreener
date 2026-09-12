"use client";

import { useEffect, useRef } from "react";

/**
 * Dark remake of Base ecosystem header motion language.
 * Motion targets from header study: traveling vertical bar clusters,
 * ~14–16px pitch, soft fringe, mouse-driven deformation, title above.
 * Palette: Meteora orange cores + pastel-black / charcoal fringes.
 * Seamless with page mineral wash — no white stage.
 */

type Cluster = {
  x: number;
  y: number;
  vx: number;
  age: number;
  maxAge: number;
  life: number;
  n: number;
  peak: number;
  seed: number;
  phase: number;
};

const PITCH = 13;
const CORE_W = 6.5;
const R = 1.5;

function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function env(u: number, seed: number, t: number, phase: number) {
  const a = Math.max(0, 1 - Math.abs(u));
  const soft = a * a * (3 - 2 * a);
  const n1 = Math.sin(u * 7 + seed + t * 1.25 + phase) * 0.14;
  const n2 = Math.sin(u * 15 + seed * 1.4 - t * 0.85) * 0.07;
  const core = Math.exp(-(u * u) * 2.35);
  return Math.max(0, soft * (0.55 + 0.45 * core) + n1 + n2);
}

function makeCluster(w: number, partial?: Partial<Cluster>): Cluster {
  const fromLeft = Math.random() > 0.5;
  const large = Math.random() > 0.35;
  return {
    x: fromLeft ? -50 - Math.random() * 80 : w + 50 + Math.random() * 80,
    y: 0.56 + Math.random() * 0.08,
    vx: (fromLeft ? 1 : -1) * (35 + Math.random() * 40),
    age: 0,
    maxAge: 7 + Math.random() * 5,
    life: 0,
    n: large ? 12 + Math.floor(Math.random() * 6) : 8 + Math.floor(Math.random() * 5),
    peak: large ? 55 + Math.random() * 35 : 28 + Math.random() * 32,
    seed: Math.random() * 1000,
    phase: Math.random() * Math.PI * 2,
    ...partial,
  };
}

/** orange → ember → dusty pastel-black */
function barColor(u: number, rel: number, a: number, hot = false) {
  const core = Math.exp(-(u * u) * 3.2);
  const edge = Math.abs(u);
  let r: number, g: number, b: number;
  if (hot && core > 0.45) {
    // localized orange crest (#ff6a00 family)
    const k = (core - 0.45) / 0.55;
    r = 255;
    g = Math.round(90 + 70 * k + 30 * rel);
    b = Math.round(0 + 40 * k * rel);
  } else if (edge > 0.72 || core < 0.35) {
    // pastel blacks #17171b / #24242b
    const g0 = 23 + 18 * (1 - edge) + 12 * rel;
    r = Math.round(g0 + 2);
    g = Math.round(g0);
    b = Math.round(g0 + 6);
  } else {
    // desaturated near-black ember / violet-ish mid
    r = Math.round(48 + 40 * (1 - Math.abs(u)));
    g = Math.round(36 + 22 * (1 - Math.abs(u)) + 8 * rel);
    b = Math.round(42 + 18 * rel);
  }
  return `rgba(${r},${g},${b},${a})`;
}

export function HeroDark() {
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
    let spawnAt = 0.8;
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
      h = Math.max(360, Math.min(490, Math.max(420, rect.height)));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (clusters.length === 0) {
        clusters.push(
          makeCluster(w, { x: w * 0.58, n: 14, peak: 78, vx: 48, life: 1, age: 2, maxAge: 14, seed: 12 }),
          makeCluster(w, { x: w * 0.28, n: 10, peak: 48, vx: -40, life: 0.85, age: 3, maxAge: 12, seed: 44 }),
        );
      }
    };

    const drawCluster = (c: Cluster, strength: number, t: number, hot = false) => {
      if (strength < 0.04) return;
      const baseline = c.y * h;
      const half = (c.n - 1) / 2 || 1;
      const fringeExtra = 7;
      const total = c.n + fringeExtra * 2;

      for (let i = 0; i < total; i++) {
        const coreIndex = i - fringeExtra;
        const u = coreIndex / half;
        const inCore = Math.abs(u) <= 1.05;
        const e = env(Math.max(-1.4, Math.min(1.4, u)), c.seed, t, c.phase);
        if (e < 0.02) continue;

        const noise = (hash(coreIndex * 13 + c.seed + Math.floor(t * 8)) - 0.5) * 6;
        const shimmer = Math.sin(t * 4.1 + coreIndex * 0.75 + c.phase) * 2;
        let height = c.peak * e * strength + noise + shimmer;
        height = Math.max(4, Math.min(124, height));

        const x = c.x + coreIndex * PITCH;
        const isFringe = !inCore || e < 0.22;
        const barW = isFringe
          ? 1.2 + hash(coreIndex + c.seed) * 1.8
          : CORE_W + (hash(coreIndex * 3 + c.seed) - 0.5) * 1.4;

        const coreA = 0.55 + 0.32 * e;
        const fringeA = 0.03 + 0.07 * e;
        const a = Math.min(0.9, (isFringe ? fringeA : coreA) * strength);

        const top = baseline - height;
        const grad = ctx.createLinearGradient(x, baseline, x, top);
        grad.addColorStop(0, barColor(u, 0, a * 0.55, hot));
        grad.addColorStop(0.45, barColor(u, 0.5, a, hot));
        grad.addColorStop(1, barColor(u, 1, a * 0.9, hot));

        if (isFringe) {
          ctx.shadowColor = `rgba(255, 106, 0, ${0.18 * a})`;
          ctx.shadowBlur = 3.5;
        } else {
          ctx.shadowColor = `rgba(255, 140, 50, ${0.12 * a})`;
          ctx.shadowBlur = 1.5;
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        const left = x - barW / 2;
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(left, top, barW, height, R);
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
      pointer.strength += ((pointer.active ? 1 : 0) - pointer.strength) * (1 - Math.exp(-dt * 4));

      ctx.clearRect(0, 0, w, h);

      spawnAt -= dt;
      if (spawnAt <= 0 && clusters.length < 2) {
        clusters.push(makeCluster(w));
        spawnAt = 1.4 + Math.random() * 2.2;
      }

      const order = [...clusters.keys()].sort((a, b) => clusters[a].n - clusters[b].n);
      for (const idx of order) {
        const c = clusters[idx];
        c.age += dt;
        c.x += c.vx * dt;
        c.phase += dt * 0.4;

        // mouse deformation (Base interactivity language)
        if (pointer.strength > 0.05 && c.n >= 9) {
          const targetX = pointer.x * w;
          c.x += (targetX - c.x) * dt * 1.7 * pointer.strength;
          c.y += (0.54 + pointer.y * 0.08 - c.y) * dt * 0.55 * pointer.strength;
        }

        const fadeIn = 0.55;
        const fadeOut = 0.65;
        if (c.age < fadeIn) c.life = c.age / fadeIn;
        else if (c.maxAge - c.age < fadeOut) c.life = Math.max(0, (c.maxAge - c.age) / fadeOut);
        else c.life = 1;

        const near =
          Math.hypot(c.x - pointer.x * w, (c.y - pointer.y) * h) < 160;
        drawCluster(c, c.life, t, near && pointer.strength > 0.15);
      }

      for (let i = clusters.length - 1; i >= 0; i--) {
        const c = clusters[i];
        const halfW = (c.n * PITCH) / 2 + 48;
        if (c.age > c.maxAge || c.x < -halfW || c.x > w + halfW) clusters.splice(i, 1);
      }

      if (pointer.strength > 0.05) {
        const local = makeCluster(w, {
          x: pointer.x * w,
          y: 0.55 + pointer.y * 0.06,
          vx: 0,
          n: 11,
          peak: 78 + (1 - pointer.y) * 36,
          life: 1,
          age: 1,
          maxAge: 2,
          seed: 30 + Math.floor(pointer.x * 15),
          phase: t,
        });
        drawCluster(local, pointer.strength, t, true);
        local.x -= 30;
        local.peak *= 0.55;
        local.n = 8;
        drawCluster(local, pointer.strength * 0.35, t + 0.4, true);
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
    <div className="hero-canvas-wrap hero-dark-wrap" ref={wrapRef} aria-hidden>
      <canvas ref={canvasRef} />
    </div>
  );
}

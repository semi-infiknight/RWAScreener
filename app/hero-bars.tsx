"use client";

import { useEffect, useRef } from "react";

/**
 * Waveform bar clusters (Base-style structure, Meteora orange on dark).
 * Thin rounded pills on a shared baseline, bright hot core, ember mid, gold tips.
 */

type Cluster = {
  x: number;
  y: number; // baseline as fraction of height
  vx: number;
  age: number;
  maxAge: number;
  life: number;
  /** number of bars */
  n: number;
  /** max height px */
  peak: number;
  /** horizontal span in px scale */
  spread: number;
  seed: number;
};

function makeCluster(partial?: Partial<Cluster>): Cluster {
  const fromLeft = Math.random() > 0.5;
  return {
    x: fromLeft ? -0.05 + Math.random() * 0.1 : 0.9 + Math.random() * 0.12,
    y: 0.58 + Math.random() * 0.06,
    vx: (fromLeft ? 1 : -1) * (0.045 + Math.random() * 0.03),
    age: 0,
    maxAge: 7 + Math.random() * 5,
    life: 0,
    n: 28 + Math.floor(Math.random() * 36), // dense like reference
    peak: 70 + Math.random() * 70,
    spread: 90 + Math.random() * 140,
    seed: Math.random() * 1000,
    ...partial,
  };
}

function hash(n: number) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

/** Organic mountain / waveform envelope 0..1 across u in [-1,1] */
function envelope(u: number, seed: number, t: number) {
  const a = Math.max(0, 1 - Math.abs(u));
  const soft = a * a * (3 - 2 * a);
  // layered noise for jagged top (not cloudy blob)
  const n1 = Math.sin(u * 9 + seed + t * 1.2) * 0.18;
  const n2 = Math.sin(u * 17 + seed * 1.7 - t * 0.8) * 0.1;
  const n3 = (hash(u * 40 + seed) - 0.5) * 0.16;
  // brighter denser core near center
  const core = Math.exp(-(u * u) * 3.2);
  return Math.max(0, soft * (0.55 + 0.45 * core) + n1 + n2 + n3) * soft;
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

    let w = 0;
    let h = 0;
    let raf = 0;
    let last = performance.now();
    let spawnAt = 1.2;

    const clusters: Cluster[] = [
      makeCluster({
        x: 0.62,
        y: 0.6,
        vx: 0.028,
        n: 52,
        peak: 120,
        spread: 200,
        life: 1,
        age: 2,
        maxAge: 14,
      }),
      makeCluster({
        x: 0.32,
        y: 0.62,
        vx: -0.02,
        n: 24,
        peak: 55,
        spread: 95,
        life: 0.85,
        age: 3,
        maxAge: 10,
      }),
      makeCluster({
        x: 0.14,
        y: 0.64,
        vx: 0.015,
        n: 12,
        peak: 28,
        spread: 48,
        life: 0.55,
        age: 4,
        maxAge: 8,
      }),
    ];

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
      h = Math.max(300, rect.height);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const colorFor = (u: number, relH: number, a: number) => {
      // center = hot white-orange core; mid = ember; edges = thin gold
      const core = Math.exp(-(u * u) * 4);
      const edge = Math.abs(u);
      let r: number, g: number, b: number;
      if (core > 0.55) {
        // white-hot core
        const k = (core - 0.55) / 0.45;
        r = 255;
        g = Math.round(210 + 45 * k);
        b = Math.round(140 + 80 * k * (1 - relH));
      } else if (edge > 0.72) {
        // gold accent tips
        r = 255;
        g = Math.round(190 + 40 * relH);
        b = Math.round(60 + 20 * relH);
      } else {
        // ember body
        r = 255;
        g = Math.round(90 + 70 * (1 - Math.abs(u)) + 40 * relH);
        b = Math.round(10 + 25 * relH);
      }
      return `rgba(${r},${g},${b},${a})`;
    };

    const drawCluster = (c: Cluster, strength: number, t: number) => {
      if (strength < 0.04) return;
      const cx = c.x * w;
      const baseline = c.y * h;
      const half = (c.n - 1) / 2;

      for (let i = 0; i < c.n; i++) {
        const u = half === 0 ? 0 : (i - half) / half; // -1..1
        const env = envelope(u, c.seed, t);
        if (env < 0.04) continue;

        const flicker = 0.94 + 0.06 * Math.sin(t * 6 + i * 0.9 + c.seed);
        const height = c.peak * env * strength * flicker;
        if (height < 2.5) continue;

        // irregular spacing like reference
        const jitter = (hash(i * 19 + c.seed) - 0.5) * 2.2;
        const x = cx + u * (c.spread * 0.5) + jitter;

        // width: thick in core, thin on edges (gold accents)
        const core = Math.exp(-(u * u) * 3.5);
        const barW = 2.2 + core * 4.2 + hash(i + c.seed) * 1.4;

        const top = baseline - height;
        const a = Math.min(0.98, 0.35 + env * strength * 0.75);

        const grad = ctx.createLinearGradient(x, baseline, x, top);
        grad.addColorStop(0, colorFor(u, 0, a * 0.85));
        grad.addColorStop(0.55, colorFor(u, 0.45, a));
        grad.addColorStop(1, colorFor(u, 1, a * 0.9));

        ctx.fillStyle = grad;
        ctx.beginPath();
        const left = x - barW / 2;
        if (typeof ctx.roundRect === "function") {
          // pill: rounded both ends
          const r = Math.min(barW / 2, 3);
          ctx.roundRect(left, top, barW, height, r);
        } else {
          ctx.rect(left, top, barW, height);
        }
        ctx.fill();
      }
    };

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;

      const pk = 1 - Math.exp(-dt * 3.5);
      pointer.x += (pointer.tx - pointer.x) * pk;
      pointer.y += (pointer.ty - pointer.y) * pk;
      pointer.strength +=
        ((pointer.active ? 1 : 0) - pointer.strength) *
        (1 - Math.exp(-dt * 4.5));

      ctx.clearRect(0, 0, w, h);

      spawnAt -= dt;
      if (spawnAt <= 0 && clusters.length < 3) {
        clusters.push(makeCluster());
        spawnAt = 1.6 + Math.random() * 2.2;
      }

      // sort so smaller/fainter draw first
      const order = [...clusters.keys()].sort(
        (a, b) => clusters[a].peak - clusters[b].peak,
      );

      for (const idx of order) {
        const c = clusters[idx];
        c.age += dt;
        c.x += c.vx * dt;

        // strongest cluster gently tracks pointer region
        if (pointer.strength > 0.05 && c.peak >= 90) {
          c.x += (pointer.x - c.x) * dt * 0.55 * pointer.strength;
          c.y += (0.55 + pointer.y * 0.12 - c.y) * dt * 0.4 * pointer.strength;
        }

        const u = c.age / c.maxAge;
        if (u < 0.12) c.life = u / 0.12;
        else if (u > 0.78) c.life = Math.max(0, (1 - u) / 0.22);
        else c.life = 1;

        drawCluster(c, c.life, t);
      }

      for (let i = clusters.length - 1; i >= 0; i--) {
        const c = clusters[i];
        if (c.age > c.maxAge || c.x < -0.35 || c.x > 1.35) clusters.splice(i, 1);
      }

      // pointer-built local waveform cluster
      if (pointer.strength > 0.05) {
        const local = makeCluster({
          x: pointer.x,
          y: 0.56 + pointer.y * 0.08,
          vx: 0,
          n: 40,
          peak: 85 + (1 - pointer.y) * 50,
          spread: 150,
          life: 1,
          age: 1,
          maxAge: 2,
          seed: 42 + Math.floor(pointer.x * 10),
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

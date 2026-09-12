"use client";

import { useEffect, useRef } from "react";

/**
 * High-detail waveform bar field (Base-inspired structure, original code).
 * Dense rounded pills, hot core, layered clusters, continuous height noise.
 * Meteora dark/orange palette.
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
  spread: number;
  seed: number;
  phase: number;
};

function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function makeCluster(partial?: Partial<Cluster>): Cluster {
  const fromLeft = Math.random() > 0.5;
  const sizeRoll = Math.random();
  const large = sizeRoll > 0.55;
  return {
    x: fromLeft ? -0.08 + Math.random() * 0.12 : 0.88 + Math.random() * 0.14,
    y: 0.56 + Math.random() * 0.08,
    vx: (fromLeft ? 1 : -1) * (0.03 + Math.random() * 0.035),
    age: 0,
    maxAge: 8 + Math.random() * 6,
    life: 0,
    n: large ? 55 + Math.floor(Math.random() * 30) : 16 + Math.floor(Math.random() * 22),
    peak: large ? 100 + Math.random() * 55 : 35 + Math.random() * 40,
    spread: large ? 170 + Math.random() * 110 : 55 + Math.random() * 70,
    seed: Math.random() * 1000,
    phase: Math.random() * Math.PI * 2,
    ...partial,
  };
}

/** Jagged mountain envelope across u ∈ [-1,1] */
function envelope(u: number, seed: number, t: number, phase: number) {
  const a = Math.max(0, 1 - Math.abs(u));
  const soft = a * a * (3 - 2 * a);
  const n1 = Math.sin(u * 8.5 + seed + t * 1.4 + phase) * 0.2;
  const n2 = Math.sin(u * 19 + seed * 1.3 - t * 1.1) * 0.11;
  const n3 = Math.sin(u * 31 + phase * 2 + t * 0.6) * 0.06;
  const n4 = (hash(Math.floor(u * 48 + seed * 3)) - 0.5) * 0.14;
  const core = Math.exp(-(u * u) * 2.8);
  return Math.max(0, (soft * (0.5 + 0.5 * core) + n1 + n2 + n3 + n4) * soft);
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
    let spawnAt = 0.9;

    const clusters: Cluster[] = [
      makeCluster({
        x: 0.64,
        y: 0.6,
        vx: 0.026,
        n: 72,
        peak: 130,
        spread: 230,
        life: 1,
        age: 2,
        maxAge: 16,
        seed: 11,
      }),
      makeCluster({
        x: 0.34,
        y: 0.62,
        vx: -0.018,
        n: 28,
        peak: 58,
        spread: 100,
        life: 0.9,
        age: 3,
        maxAge: 11,
        seed: 37,
      }),
      makeCluster({
        x: 0.16,
        y: 0.64,
        vx: 0.014,
        n: 14,
        peak: 30,
        spread: 52,
        life: 0.6,
        age: 4.5,
        maxAge: 9,
        seed: 71,
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
      h = Math.max(320, rect.height);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const colorFor = (u: number, relH: number, a: number) => {
      const core = Math.exp(-(u * u) * 3.8);
      const edge = Math.abs(u);
      let r: number, g: number, b: number;
      if (core > 0.5) {
        const k = (core - 0.5) / 0.5;
        // hot core → near white
        r = 255;
        g = Math.round(185 + 60 * k + 20 * relH);
        b = Math.round(90 + 110 * k * (0.4 + 0.6 * relH));
      } else if (edge > 0.75) {
        // thin gold edge accents
        r = 255;
        g = Math.round(175 + 55 * relH);
        b = Math.round(45 + 30 * relH);
      } else {
        r = 255;
        g = Math.round(85 + 75 * (1 - Math.abs(u)) + 35 * relH);
        b = Math.round(8 + 22 * relH);
      }
      return `rgba(${r},${g},${b},${a})`;
    };

    const drawPill = (
      x: number,
      baseline: number,
      height: number,
      barW: number,
      fill: CanvasGradient | string,
    ) => {
      const top = baseline - height;
      const left = x - barW / 2;
      const r = Math.min(barW / 2, height / 2, 4);
      ctx.fillStyle = fill;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(left, top, barW, height, r);
      } else {
        ctx.rect(left, top, barW, height);
      }
      ctx.fill();
    };

    const drawCluster = (c: Cluster, strength: number, t: number) => {
      if (strength < 0.03) return;
      const cx = c.x * w;
      const baseline = c.y * h;
      const half = (c.n - 1) / 2 || 1;

      // soft ambient glow behind dense clusters (tight, not cloudy)
      if (c.n > 40 && strength > 0.4) {
        const g = ctx.createRadialGradient(
          cx,
          baseline - c.peak * 0.35,
          8,
          cx,
          baseline - c.peak * 0.35,
          c.spread * 0.55,
        );
        g.addColorStop(0, `rgba(255, 120, 20, ${0.12 * strength})`);
        g.addColorStop(1, "rgba(255, 120, 20, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(
          cx - c.spread * 0.6,
          baseline - c.peak * 1.2,
          c.spread * 1.2,
          c.peak * 1.4,
        );
      }

      for (let i = 0; i < c.n; i++) {
        const u = (i - half) / half;
        let env = envelope(u, c.seed, t, c.phase);
        // continuous per-bar height shimmer
        env *= 0.9 + 0.1 * Math.sin(t * 5.5 + i * 0.73 + c.seed);
        if (env < 0.035) continue;

        const height = c.peak * env * strength;
        if (height < 2.2) continue;

        const jitter = (hash(i * 17 + c.seed) - 0.5) * 1.8;
        const x = cx + u * (c.spread * 0.5) + jitter;
        const core = Math.exp(-(u * u) * 3.2);
        const barW = 1.8 + core * 4.6 + hash(i * 3 + c.seed) * 1.6;
        const a = Math.min(0.98, 0.28 + env * strength * 0.8);

        const grad = ctx.createLinearGradient(x, baseline, x, baseline - height);
        grad.addColorStop(0, colorFor(u, 0, a * 0.75));
        grad.addColorStop(0.45, colorFor(u, 0.4, a));
        grad.addColorStop(1, colorFor(u, 1, a * 0.92));

        // faint after-image stem
        ctx.globalAlpha = a * 0.12;
        ctx.fillStyle = "rgb(255, 110, 20)";
        ctx.fillRect(x - barW * 0.35, baseline, barW * 0.7, Math.min(18, height * 0.2));
        ctx.globalAlpha = 1;

        drawPill(x, baseline, height, barW, grad);
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
        clusters.push(makeCluster());
        spawnAt = 1.4 + Math.random() * 2.4;
      }

      const order = [...clusters.keys()].sort(
        (a, b) => clusters[a].n - clusters[b].n,
      );

      for (const idx of order) {
        const c = clusters[idx];
        c.age += dt;
        c.x += c.vx * dt;
        c.phase += dt * 0.35;

        if (pointer.strength > 0.05 && c.n >= 50) {
          c.x += (pointer.x - c.x) * dt * 0.5 * pointer.strength;
          c.y += (0.56 + pointer.y * 0.1 - c.y) * dt * 0.35 * pointer.strength;
        }

        const u = c.age / c.maxAge;
        if (u < 0.1) c.life = u / 0.1;
        else if (u > 0.8) c.life = Math.max(0, (1 - u) / 0.2);
        else c.life = 1;

        drawCluster(c, c.life, t);
      }

      for (let i = clusters.length - 1; i >= 0; i--) {
        const c = clusters[i];
        if (c.age > c.maxAge || c.x < -0.4 || c.x > 1.4) clusters.splice(i, 1);
      }

      if (pointer.strength > 0.04) {
        const local = makeCluster({
          x: pointer.x,
          y: 0.55 + pointer.y * 0.08,
          vx: 0,
          n: 58,
          peak: 95 + (1 - pointer.y) * 45,
          spread: 190,
          life: 1,
          age: 1,
          maxAge: 2,
          seed: 20 + Math.floor(pointer.x * 20),
          phase: t,
        });
        drawCluster(local, pointer.strength, t);
        // faint lag trail
        local.x -= 0.035;
        local.peak *= 0.55;
        local.n = 36;
        drawCluster(local, pointer.strength * 0.35, t + 0.5);
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

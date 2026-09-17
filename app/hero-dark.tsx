"use client";

import { useEffect, useRef } from "react";

/**
 * Compact dark remake of Base header motion:
 * fine vertical hairlines in soft clusters (not chunky "token bars"),
 * pastel-black field + localized orange crest on pointer wake.
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

const PITCH = 7; // fine spacing
const CORE_W = 2.4; // hairline cores
const R = 0.8;

function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function envelope(u: number, seed: number, t: number, phase: number) {
  const a = Math.max(0, 1 - Math.abs(u));
  const soft = a * a * (3 - 2 * a);
  const n1 = Math.sin(u * 9 + seed + t * 1.1 + phase) * 0.12;
  const n2 = Math.sin(u * 21 + seed * 1.3 - t * 0.7) * 0.06;
  const n3 = (hash(u * 40 + seed) - 0.5) * 0.05;
  const core = Math.exp(-(u * u) * 2.1);
  return Math.max(0, soft * (0.5 + 0.5 * core) + n1 + n2 + n3);
}

function makeCluster(w: number, partial?: Partial<Cluster>): Cluster {
  const fromLeft = Math.random() > 0.5;
  const large = Math.random() > 0.4;
  return {
    x: fromLeft ? -40 - Math.random() * 60 : w + 40 + Math.random() * 60,
    y: 0.62 + Math.random() * 0.1,
    vx: (fromLeft ? 1 : -1) * (28 + Math.random() * 36),
    age: 0,
    maxAge: 9 + Math.random() * 6,
    life: 0,
    // denser: 18–32 fine bars
    n: large ? 22 + Math.floor(Math.random() * 10) : 14 + Math.floor(Math.random() * 8),
    peak: large ? 42 + Math.random() * 28 : 22 + Math.random() * 22,
    seed: Math.random() * 1000,
    phase: Math.random() * Math.PI * 2,
    ...partial,
  };
}

function barColor(u: number, rel: number, a: number, hot: boolean) {
  const core = Math.exp(-(u * u) * 2.8);
  const edge = Math.abs(u);
  let r: number, g: number, b: number;
  if (hot && core > 0.4) {
    const k = (core - 0.4) / 0.6;
    r = 255;
    g = Math.round(100 + 60 * k + 25 * rel);
    b = Math.round(10 + 35 * k * rel);
  } else if (edge > 0.7 || core < 0.28) {
    // pastel black fringe
    const g0 = 20 + 14 * (1 - edge) + 10 * rel;
    r = Math.round(g0 + 3);
    g = Math.round(g0);
    b = Math.round(g0 + 8);
  } else {
    // soft graphite / near-black violet mid
    r = Math.round(36 + 28 * (1 - Math.abs(u)));
    g = Math.round(32 + 18 * (1 - Math.abs(u)) + 6 * rel);
    b = Math.round(40 + 16 * rel);
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
    let running = false;
    let inView = true;
    let last = performance.now();
    let spawnAt = 1.2;
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
      h = Math.max(140, Math.min(200, rect.height || 168));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (clusters.length === 0) {
        clusters.push(
          makeCluster(w, {
            x: w * 0.62,
            n: 28,
            peak: 52,
            vx: 34,
            life: 1,
            age: 2,
            maxAge: 16,
            seed: 12,
          }),
          makeCluster(w, {
            x: w * 0.28,
            n: 20,
            peak: 34,
            vx: -28,
            life: 0.9,
            age: 3,
            maxAge: 14,
            seed: 44,
          }),
          makeCluster(w, {
            x: w * 0.85,
            n: 16,
            peak: 26,
            vx: 22,
            life: 0.55,
            age: 5,
            maxAge: 12,
            seed: 71,
          }),
        );
      }
    };

    const drawCluster = (c: Cluster, strength: number, t: number, hot: boolean) => {
      if (strength < 0.04) return;
      const baseline = c.y * h;
      const half = (c.n - 1) / 2 || 1;
      const fringeExtra = 10;
      const total = c.n + fringeExtra * 2;

      for (let i = 0; i < total; i++) {
        const coreIndex = i - fringeExtra;
        const u = coreIndex / half;
        const e = envelope(Math.max(-1.45, Math.min(1.45, u)), c.seed, t, c.phase);
        if (e < 0.015) continue;

        const noise = (hash(coreIndex * 17 + c.seed + Math.floor(t * 6)) - 0.5) * 3.5;
        const shimmer = Math.sin(t * 3.4 + coreIndex * 0.55 + c.phase) * 1.2;
        let height = c.peak * e * strength + noise + shimmer;
        height = Math.max(3, Math.min(h * 0.72, height));

        // soft vertical tail: draw as gradient alpha already; also taper width
        const x = c.x + coreIndex * PITCH;
        const isFringe = Math.abs(u) > 1.02 || e < 0.2;
        const barW = isFringe
          ? 0.7 + hash(coreIndex + c.seed) * 1.1
          : CORE_W + (hash(coreIndex * 3 + c.seed) - 0.5) * 0.8;

        const coreA = 0.35 + 0.4 * e;
        const fringeA = 0.02 + 0.08 * e;
        const a = Math.min(0.78, (isFringe ? fringeA : coreA) * strength);

        const top = baseline - height;
        const grad = ctx.createLinearGradient(x, baseline, x, top);
        grad.addColorStop(0, barColor(u, 0, a * 0.15, hot));
        grad.addColorStop(0.35, barColor(u, 0.35, a * 0.75, hot));
        grad.addColorStop(0.75, barColor(u, 0.75, a, hot));
        grad.addColorStop(1, barColor(u, 1, a * 0.55, hot));

        ctx.shadowBlur = hot && !isFringe ? 2 : isFringe ? 1.2 : 0;
        ctx.shadowColor = hot
          ? `rgba(255, 106, 0, ${0.2 * a})`
          : `rgba(180, 180, 200, ${0.08 * a})`;

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

      const pk = 1 - Math.exp(-dt * 3.4);
      pointer.x += (pointer.tx - pointer.x) * pk;
      pointer.y += (pointer.ty - pointer.y) * pk;
      pointer.strength +=
        ((pointer.active ? 1 : 0) - pointer.strength) * (1 - Math.exp(-dt * 4));

      ctx.clearRect(0, 0, w, h);

      spawnAt -= dt;
      if (spawnAt <= 0 && clusters.length < 3) {
        clusters.push(makeCluster(w));
        spawnAt = 1.8 + Math.random() * 2.5;
      }

      const order = [...clusters.keys()].sort((a, b) => clusters[a].n - clusters[b].n);
      for (const idx of order) {
        const c = clusters[idx];
        c.age += dt;
        c.x += c.vx * dt;
        c.phase += dt * 0.35;

        if (pointer.strength > 0.05) {
          const dist = Math.hypot(c.x - pointer.x * w, (c.y - pointer.y) * h);
          if (dist < 170 && c.n >= 16) {
            c.x += (pointer.x * w - c.x) * dt * 1.4 * pointer.strength;
            c.y += (0.58 + pointer.y * 0.08 - c.y) * dt * 0.5 * pointer.strength;
          }
        }

        const fadeIn = 0.7;
        const fadeOut = 0.8;
        if (c.age < fadeIn) c.life = c.age / fadeIn;
        else if (c.maxAge - c.age < fadeOut)
          c.life = Math.max(0, (c.maxAge - c.age) / fadeOut);
        else c.life = 1;

        const near =
          Math.hypot(c.x - pointer.x * w, (c.y - pointer.y) * h) < 150;
        drawCluster(c, c.life, t, near && pointer.strength > 0.12);
      }

      for (let i = clusters.length - 1; i >= 0; i--) {
        const c = clusters[i];
        const halfW = (c.n * PITCH) / 2 + 60;
        if (c.age > c.maxAge || c.x < -halfW || c.x > w + halfW) {
          clusters.splice(i, 1);
        }
      }

      if (pointer.strength > 0.05) {
        const local = makeCluster(w, {
          x: pointer.x * w,
          y: 0.58 + pointer.y * 0.08,
          vx: 0,
          n: 26,
          peak: 48 + (1 - pointer.y) * 22,
          life: 1,
          age: 1,
          maxAge: 2,
          seed: 30 + Math.floor(pointer.x * 20),
          phase: t,
        });
        drawCluster(local, pointer.strength, t, true);
        local.x -= 22;
        local.peak *= 0.55;
        local.n = 18;
        drawCluster(local, pointer.strength * 0.4, t + 0.35, true);
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

    // Don't burn frames while the hero is scrolled off or the tab is hidden.
    const start = () => {
      if (running || !inView || document.hidden) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(draw);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };
    const io = new IntersectionObserver(
      (entries) => {
        inView = Boolean(entries[0]?.isIntersecting);
        if (inView) start();
        else stop();
      },
      { threshold: 0 },
    );
    io.observe(wrap);
    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    resize();
    start();
    window.addEventListener("resize", resize);
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerleave", onLeave);
    wrap.addEventListener("pointerdown", onMove);

    return () => {
      stop();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
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

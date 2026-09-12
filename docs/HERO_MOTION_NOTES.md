# Our hero motion notes (observed from Base ecosystem; original implementation)

Observation-only reference for retuning `app/hero-bars.tsx`. No Base source, shaders, or brand assets are copied into the product.

Captured at roughly 1280 CSS px wide on the Base ecosystem page (viewport content width ~1265 px with scrollbar). Screenshots lived under box `/workspace/base-ecosystem-ref/` during study.

## Visual / motion notes

- Discrete vertical pastel bars in traveling clusters (not a single continuous waveform). Strong cluster: about **8–12 saturated bars**; with pale fringe about **18–26 bars** wide.
- Core pitch ~**14–16 px**: ~**8–10 px** bar width, **4–6 px** gap. Fringe bars ~**1–3 px**. Axis-aligned, clean vertical edges.
- Core heights ~**28–76 px**; pale envelope ~**80–120 px**. Light **1–2 px** corner radius (not capsules).
- On Base: periwinkle/indigo/lavender (we use Meteora orange). Core alpha **0.65–0.9**; fringe **0.03–0.12**.
- Drift ~**50–120 px/s**. Cluster birth ~**0.5–1.0 s**; trail washout ~**0.4–0.8 s**.
- Typically **1–3** strong groups; core island ~100–150 px; fringe envelope ~180–220 px.
- Height noise ~**±1–4 px** plus smooth enter/leave height change.
- Effect sits **behind** the headline (lower z-layer).
- Softening: cores ~0–1 px; fringe glow/blur ~**2–5 px** only. No large neon bloom.

## Recreation starting values (our canvas 2d)

```text
cluster count: 2–3 active groups
bars per strong group: 8–12 core; 18–26 including fringe
bar width: 8–10 px core; 1–3 px fringe
bar gap: 4–6 px (pitch 14–16 px)
bar height: 28–76 px core; 80–120 px full envelope
corner radius: 1–2 px
core alpha: 0.65–0.90; fringe alpha: 0.03–0.12
palette: Meteora orange / ember (not Base periwinkle)
motion: smooth drift ≈50–120 px/s
fade: ≈400–800 ms
height noise: ±1–4 px
```

Base page used WebGL canvases (~1265×490 and 1265×332). Ours is original Canvas 2D with the metrics above.

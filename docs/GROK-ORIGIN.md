# Grok origin — compressed (read this, not the 30k-line transcripts)

Grok CLI built **meteora-intel** in `~/Vibecode/meteco` (Sep 2026). That folder is retired. Live product is **RWAScreener `packages/intel` + meteora.fyi**. Raw exports: `docs/archive/meteco/docs-grok/`. Do not re-run the Grok Build harness verifiers.

## Operator intent (Grok, in order)

1. Save X Consumer / Secret / Bearer in env (done: local `.env` + Railway `intel`/`scanner`).
2. **Sentient mention tracker** — Meteora / DBC / integrated pads / pads wanting help / builders talking tech. **Buckets, builder+tech crowd**, leads toward launching a pad on Meteora. Not ticker tape.
3. **Sweet spot: fast + semantic.** Not a keyword rulebook, not a slow LLM that “reads each tweet and thinks.” Transformers / embeddings. Shipped: `bge-small-en-v1.5` cosine vs few-shot bucket examples (`src/buckets.ts`). MiniLM was the first sketch; **BGE is the decision.**
4. Probe intelligence (“war machine”), then **tune buckets by examples**.
5. Stop shipping **fake/demo posts** — real X backfill into the seed.

Later Cursor session (same product, after Grok): take down the intel website; **only meteora.fyi**; follow Vesper by **reading interactions**; newest-first; no LP army. That supersedes Grok’s public “METEORA INTEL” site + time filters + leaderboard chrome.

## What Grok actually shipped (then)

- TS CLI: scan / classify / JSONL store / leads report
- X recent-search queries from a Meteora glossary (DBC, DLMM, DAMM v2, Invent, quote mint, Alpha Vault, …)
- Local site **like solbigweek.com** (feed, time windows, leaderboard) — **no longer public**. HTML routes 301 to meteora.fyi; API remains.
- New Railway project so the site was live — **old `meteora-intel` project is leftover**; do not revive. Use rwascreener `intel` + `scanner`.

## Glossary still useful

| Term | Meaning |
|------|---------|
| DBC | Dynamic Bonding Curve launch; graduates to DAMM |
| DAMM v2 | Post-graduation AMM (`cp_amm`) |
| DLMM | Bin AMM — usually **not** the public feed’s job |
| PoolConfig | Partner launch template (fee_claimer, quote, curve) |
| Invent / Fun Launch | Official pad scaffold |
| Alpha Vault | Pre-launch deposit vault — often **LP-adjacent; don’t promote in ecosystem feed** |

Tune **search** toward builders/SDK/pads; keep `lang:` **off** (operator later: all languages). Classifier is still English.

## Ignore in the raw Grok dump

- Adversarial “goal verifier / refute / audit” sessions — harness ceremony, not product.
- Goal-plan-writer walls of text — plans already folded into `.cursor/plans/` + `docs/ETHOS.md`.
- solbigweek time filters / leaderboard as **homepage UX** — operator later forbade time filters, scores, and a second intel site.

## Agent files to prefer

| File | Use |
|------|-----|
| `docs/ETHOS.md` + `docs/TODO.md` | Current operator law |
| `docs/CLOUD-RESUME.md` | Topology + Railway |
| `.cursor/rules/ethos.mdc` | Always-on |
| `docs/GROK-ORIGIN.md` | This file |
| `docs/archive/meteco/USER-PROMPTS.md` | Cursor chat operator lines |
| `docs/archive/meteco/docs-grok/*` | Only if you need a primary source |

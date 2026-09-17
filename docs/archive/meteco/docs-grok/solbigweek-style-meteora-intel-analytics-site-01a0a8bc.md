# Solbigweek-style Meteora intel analytics site

- Grok session: `01a0a8bc-28b3-7d50-89a3-cf2b7506f807`
- cwd: `/Users/semi/Vibecode/meteco`
- model: `grok-4.6`
- raw: `/Users/semi/.grok/sessions/%2FUsers%2Fsemi%2FVibecode%2Fmeteco/01a0a8bc-28b3-7d50-89a3-cf2b7506f807/chat_history.jsonl`

---

> [system prompt omitted]


## User

[system-reminder omitted]


## User

You are the Goal Summarizer for the xAI Grok Build harness. The goal has just been VERIFIED as achieved. Write the single CLOSING message the user reads: a VERY concise recap of WHAT was delivered and HOW to use it.

## Your job

In short, plain, complete sentences, tell the user:

1. WHAT was delivered — the artifact that now exists (e.g. a playable browser game, a CLI, an HTTP API, a library).
2. HOW to use it — the exact command or steps to run / open / play / call it (e.g. "open `index.html` in a browser", "run `npm start`", "`cargo run`").

Lead with one sentence naming the artifact, then the how-to-use steps. Give the user enough context to act without reading the transcript; do not compress into telegraphic fragments.

## How to find this

Inspect the delivered workspace with your `read_file`/`grep`/`list_dir` tools: the entry point (e.g. `index.html`, a `README`, `package.json` scripts, `main` / `Cargo.toml`, a server's run command) tells you what it is and how to run it. Use the OBJECTIVE (below) and the acceptance plan `/Users/semi/.grok/sessions/%2FUsers%2Fsemi%2FVibecode%2Fmeteco/01a09fd9-4221-7b30-887b-33a385d879e9/goal/plan.md` (may be absent) for intent, and the transcript at `/Users/semi/.grok/sessions/%2FUsers%2Fsemi%2FVibecode%2Fmeteco/01a09fd9-4221-7b30-887b-33a385d879e9` (`chat_history.jsonl`) only if needed. The verifier's findings `/Users/semi/.grok/sessions/%2FUsers%2Fsemi%2FVibecode%2Fmeteco/01a09fd9-4221-7b30-887b-33a385d879e9/goal/goal-classifier-59e6e50b072d-1.md` are context only — do NOT echo the review.

## Read-only — do not touch the workspace

You are READ-ONLY. Do NOT edit, create, move, or delete any file, and do NOT run any command. Only read, search, and list. The goal is already complete.

## Output contract

Output ONLY the summary as your final message (Markdown, no preamble like "Here is the summary", no terminal token). Structure:

1. One sentence naming WHAT was delivered.
2. HOW to use it: the exact command(s) / steps (one short line or up to 3 bullets).

HARD LIMIT: at most 80 words and at most 4 bullets. Do NOT exceed this — a skimmable summary is REQUIRED, not a wall of text. Within the cap, prefer complete sentences over dropped detail written as shorthand.


OBJECTIVE:
https://www.solbigweek.com/

Can u use meteora intel to build a site similar to this


## Assistant

I'll inspect the workspace and goal plan so the closing recap matches what was actually delivered.

  - `list_dir`(target_directory='/Users/semi/Vibecode/meteco')
  - `read_file`(target_file='/Users/semi/.grok/sessions/%2FUsers%2Fsemi%2FVibecode%2Fmeteco/01a09fd9-4221-7b3'…, limit='150')
  - `list_dir`(target_directory='/Users/semi/.grok/sessions/%2FUsers%2Fsemi%2FVibecode%2Fmeteco/01a09fd9-4221-7b3'…)

<details><summary>tool result</summary>

```
1→# Plan: Public web site like solbigweek.com, powered by meteora-intel (classified Meteora/DBC X posts, filters, leaderboard)

## Goal kind
code-change

## Acceptance criteria
1. A launchable website shows a feed of X posts sourced from meteora-intel’s classified store: at least author handle, post text (or snippet), link to the post, and the intel bucket; default view excludes suppressed retail-hype noise.
2. The same site exposes time-window filters comparable to solbigweek (at least all / today / this week) that change which stored posts appear in the feed, using the posts’ timestamps (or scan time when created-at is missing).
3. A leaderboard view ranks X accounts from that same classified store (e.g. by post count and/or lead score), excluding suppressed noise, with a way to navigate between feed and leaderboard.
10→4. The shipped CLI/offline scan path can populate the store the site reads (demo/offline fixtures sufficient); the site must render that data without requiring live X credits.

## Verification plan
1. gating: Add or update in-repo tests that call the shipped feed/filter/leaderboard functions on fixed classified mention records (including one suppressed noise row and dated rows spanning today vs older). Assert: default feed omits noise; time windows change membership; leaderboard order matches the ranking rule and omits noise. Run them; capture stdout/stderr to `{SCRATCH}/site-logic-tests.log` with exit code 0.
2. gating: Seed the store via the real offline s
…[truncated — see raw jsonl]
```

</details>

<details><summary>tool result</summary>

```
- /Users/semi/.grok/sessions/%2FUsers%2Fsemi%2FVibecode%2Fmeteco/01a09fd9-4221-7b30-887b-33a385d879e9/goal/
  - goal-classifier-261ad0a4bdd2-1.md
  - goal-classifier-59e6e50b072d-1.md
  - plan.baseline.md
  - plan.md
  - state.json
```

</details>

<details><summary>tool result</summary>

```
- /Users/semi/Vibecode/meteco/
  - brand.md
  - meteora-intel/
    - data/
      - mentions.jsonl
      - runs.jsonl
    - node_modules/
      - @esbuild/
        - darwin-arm64/
          [3 files in subtree: 1 *.json, 1 *.md, 1 *no-ext]
      - @huggingface/
        - jinja/
          [13 files in subtree: 7 *.ts, 2 *.json, 1 *.cjs, ...]
      - @protobufjs/
        - aspromise/
          [6 files in subtree: 2 *.js, 1 *.json, 1 *.md, ...]
        - base64/
          [6 files in subtree: 2 *.js, 1 *.json, 1 *.md, ...]
        - codegen/
          [6 files in subtree: 2 *.js, 1 *.json, 1 *.md, ...]
        - eventemitter/
          [7 files in subtree: 2 *.js, 2 *.md, 1 *.json, ...]
        - fetch/
          [9 files in subtree: 3 *.js, 2 *.md, 1 *.json, ...]
        - float/
          [8 files in subtree: 4 *.js, 1 *.json, 1 *.md, ...]
        - inquire/
          [11 files in subtree: 6 *.js, 2 *.md, 1 *.json, ...]
        - path/
          [6 files in subtree: 2 *.js, 1 *.json, 1 *.md, ...]
        - pool/
          [6 files in subtree: 2 *.js, 1 *.json, 1 *.md, ...]
        - utf8/
          [9 files in subtree: 2 *.js, 2 *.md, 2 *.txt, ...]
      - @types/
        - long/
          [4 files in subtree: 1 *.json, 1 *.md, 1 *no-ext, ...]
        - node/
          [74 files in subtree: 71 *.ts, 1 *.json, 1 *.md, ...]
      - @xenova/
        - transformers/
          [59 files in subtree: 18 *.js, 18 *.map, 16 *.ts, ...]
      - b4a/
        - browser.js
        - index.d
…[truncated — see raw jsonl]
```

</details>


## User

[system-reminder omitted]

  - `read_file`(target_file='/Users/semi/Vibecode/meteco/meteora-intel/package.json')
  - `read_file`(target_file='/Users/semi/Vibecode/meteco/meteora-intel/README.md', limit='120')
  - `grep`(pattern='site|scan --demo|npm run', path='/Users/semi/Vibecode/meteco/meteora-intel', glob='*.{md,json,ts}', head_limit='40')

<details><summary>tool result</summary>

```
1→{
  "name": "meteora-intel",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Local-transformer intel tracker for Meteora / DBC builder & launchpad mentions on X",
  "scripts": {
    "scan": "tsx src/cli.ts scan",
    "report": "tsx src/cli.ts report",
10→    "leads": "tsx src/cli.ts leads",
    "classify-demo": "tsx src/cli.ts classify-demo",
    "probe": "tsx scripts/probe-intelligence.ts",
    "site": "tsx src/site-server.ts",
    "test": "tsx --test --test-concurrency=1 test/*.test.ts",
    "typecheck": "tsc --noEmit"
  },
  "engines": {
    "node": ">=20"
  },
20→  "dependencies": {
    "@xenova/transformers": "^2.17.2",
    "dotenv": "^16.4.7"
  },
  "devDependencies": {
    "@types/node": "^22.13.10",
    "tsx": "^4.19.3",
    "typescript": "^5.8.2"
  }
}
30→
```

</details>

<details><summary>tool result</summary>

```
1→# meteora-intel

Local, builder-focused intel tracker for **Meteora**, **DBC (Dynamic Bonding Curve)**, related launch tech, and **launchpad leads**.

It pulls recent X posts, then classifies them with a **free local sentence transformer** (`bge-small-en-v1.5` via `@xenova/transformers`) — cosine to bucket prototypes, not keyword rules and not an LLM “read then think” pass.

## Why

Find people and teams who are:
10→
- building with / integrating Meteora DBC
- shipping Fun Launch / Invent scaffolds
- running or exploring launchpads on (or toward) Meteora
- asking for help / partnership
- complaining about competitor launch UX (outbound signals)

…and bucket them so BD can convert high-intent builders into **launchpads on Meteora**.

## Buckets
20→
| id | intent |
|----|--------|
| `builder_integrating_sdk` | SDK / CPI / PoolConfig work |
| `scaffold_forker` | Fun Launch / Invent forks |
| `pad_migrating_or_exploring` | Pads exploring or migrating to DBC |
| `vertical_quote_meta` | Token-2022 / RWA / custom quote verticals |
| `pad_live_on_dbc` | Already live on DBC |
| `token_team_wants_pad` | Single project wants branded launch UX |
| `infra_bot_indexer` | Bots / indexers / analytics |
30→| `lp_alpha_vault_launch` | Alpha Vault / fair-launch LP design |
| `competitor_pain` | Pain on other pads → outbound |
| `noise_retail_hype` | Price spam — suppressed from leads |

## Setup

From repo root, keys already live in `../.env`:

```bash
X_API_KEY=...
40→X_API_SECRET=...
X_BEAR
…[truncated — see raw jsonl]
```

</details>

<details><summary>tool result</summary>

```
<workspace_result workspace_path="/Users/semi/Vibecode/meteco">
Found at least 27 matching lines
/Users/semi/Vibecode/meteco/meteora-intel/package.json
13:    "site": "tsx src/site-server.ts",

/Users/semi/Vibecode/meteco/meteora-intel/src/report.ts
17:    console.log("No data yet. Run: npm run scan");

/Users/semi/Vibecode/meteco/meteora-intel/src/x-client.ts
65:      return "X API credits depleted. Offline path still works: npm run scan -- --demo";
67:    return "X API auth/permission error. Offline path still works: npm run scan -- --demo";

/Users/semi/Vibecode/meteco/meteora-intel/src/site-server.ts
9:} from "./site-data.js";
10:import { renderPage } from "./site-html.js";
11:import { isNoise } from "./site-data.js";
81:    console.log(`Meteora Intel site http://${host}:${port}`);
86:if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("site-server.ts")) {

/Users/semi/Vibecode/meteco/meteora-intel/README.md
58:npm run probe          # adversarial intelligence battery
61:npm run classify-demo
62:npm run scan -- --demo
63:npm run scan -- --demo --force   # rewrite demo-* rows
66:npm run scan
67:npm run scan -- --max=20 --query=dbc_sdk
70:npm run report
71:npm run leads
74:npm run scan -- --demo --force
75:npm run site

/Users/semi/Vibecode/meteco/meteora-intel/src/cli.ts
27:  npm run scan -- [--max=25] [--query=dbc_sdk] [--demo] [--force]
28:  npm run report
29:  npm run leads -- [--limit=20]
30:  npm run classify-demo
31:  npm run site        
…[truncated — see raw jsonl]
```

</details>


## Assistant

A **solbigweek-style Meteora intel site** is in `meteora-intel`: a classified X feed (author, text, post link, bucket; retail-hype hidden) plus an account leaderboard, with All / Today / This week filters.

- Seed without live X: `cd meteora-intel && npm run scan -- --demo --force`
- Start the site: `npm run site`
- Open [http://127.0.0.1:8787](http://127.0.0.1:8787) for the feed and `/leaderboard` (or `?window=today|week|all`). Live ingest is `npm run scan` when X credits are available.

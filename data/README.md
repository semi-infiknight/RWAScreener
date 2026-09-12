# Static seed

`projects.json` is the source of truth for the DBC ecosystem dashboard until on-chain indexing lands.

## Status labels

| Status | Meaning |
| --- | --- |
| `live` | Public product with DBC (or partner) integration we can point at |
| `integrating` | Building / shipping DBC path; not fully verified live |
| `in_contact` | We are talking with the team (relationship signal) |
| `discovered` | Found or listed; thin public proof so far |

Labels describe **what we know** and **our relationship**. They are **not** endorsements.

## Editing

1. Edit `projects.json`.
2. Keep `id` stable (kebab-case).
3. Prefer adding `sources` URLs over prose-only claims.
4. Leave `contact` as `unknown` until a human sets it.

# RWAScreener indexer worker — run from repo root context:
#   docker build -f apps/indexer/Dockerfile -t rwascreener-indexer .
FROM node:22-bookworm-slim

WORKDIR /app

# Root package manifests (pg, bs58, meteora sdk used by packages/dbc)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY packages ./packages
COPY data/quote-mints.json ./data/quote-mints.json
COPY data/launchpad-labels.json ./data/launchpad-labels.json
COPY apps/indexer ./apps/indexer

ENV NODE_ENV=production
WORKDIR /app

# Default: webhook stub. Override start command for one-shot backfill:
#   node apps/indexer/index.mjs backfill
#   node apps/indexer/index.mjs migrate
#   node apps/indexer/index.mjs ingest
CMD ["node", "apps/indexer/index.mjs", "serve"]

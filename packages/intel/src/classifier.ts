import { pipeline, env } from "@xenova/transformers";
import {
  BUCKETS,
  BUCKET_BY_ID,
  NOISE_GATE_MARGIN,
  OFFICIAL_HANDLES,
  SECONDARY_MARGIN,
  SIGNAL_FLOOR,
  type BucketId,
} from "./buckets.js";
import { join } from "node:path";
import { PKG_ROOT } from "./config.js";
import { isRetailFeedSpam } from "./ecosystem-anchor.js";

// Cache models under the package so first run is self-contained.
env.cacheDir = join(PKG_ROOT, ".cache", "transformers");
env.allowLocalModels = true;

/**
 * Small bi-encoder in the MiniLM speed class, sharper intent geometry.
 * BGE-small ~33M / 384-d. Classify via cosine to prototypes — not NLI, not LLM.
 */
export const EMBEDDING_MODEL = "Xenova/bge-small-en-v1.5";

type Embedder = (text: string, opts?: Record<string, unknown>) => Promise<{
  data: Float32Array | number[];
  dims?: number[];
}>;

let embedderPromise: Promise<Embedder> | null = null;
/** Multiple prototype vectors per bucket; score = max cosine */
let bucketVectors: { id: BucketId; vectors: Float32Array[] }[] | null = null;

async function getEmbedder(): Promise<Embedder> {
  if (!embedderPromise) {
    embedderPromise = pipeline(
      "feature-extraction",
      EMBEDDING_MODEL,
    ) as Promise<Embedder>;
  }
  return embedderPromise;
}

function meanPool(tensor: Float32Array | number[], dims: number[]): Float32Array {
  if (dims.length === 2) {
    const [seq, hidden] = dims;
    if (seq === 1) return Float32Array.from(tensor);
    const out = new Float32Array(hidden);
    for (let t = 0; t < seq; t++) {
      for (let h = 0; h < hidden; h++) {
        out[h] += Number(tensor[t * hidden + h]);
      }
    }
    for (let h = 0; h < hidden; h++) out[h] /= seq;
    return out;
  }
  if (dims.length === 3) {
    const [, seq, hidden] = dims;
    const out = new Float32Array(hidden);
    for (let t = 0; t < seq; t++) {
      for (let h = 0; h < hidden; h++) {
        out[h] += Number(tensor[t * hidden + h]);
      }
    }
    for (let h = 0; h < hidden; h++) out[h] /= seq;
    return out;
  }
  return Float32Array.from(tensor);
}

function l2Normalize(v: Float32Array): Float32Array {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  const norm = Math.sqrt(sum) || 1;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / norm;
  return out;
}

function cosine(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return dot;
}

async function embedText(text: string): Promise<Float32Array> {
  const embedder = await getEmbedder();
  // Mean + L2 is the Transformers.js BGE recipe and stays in the same 384-d space
  // as prototypes. CLS pooling in this ONNX build collapsed intent scores.
  const output = (await embedder(text, {
    pooling: "mean",
    normalize: true,
  })) as { data: Float32Array | number[]; dims?: number[] };

  if (output.dims && output.dims.length > 1) {
    return l2Normalize(meanPool(output.data, output.dims));
  }
  return l2Normalize(Float32Array.from(output.data));
}

async function ensureBucketVectors() {
  if (bucketVectors) return;
  const vectors: { id: BucketId; vectors: Float32Array[] }[] = [];
  for (const bucket of BUCKETS) {
    if (bucket.overrideOnly) continue;
    // Few-shot utterances only. Long overlapping descriptions collapse
    // nearby pad-intents (live vs exploring vs SDK) into one blob.
    const prototypes = bucket.examples.length
      ? bucket.examples
      : [`${bucket.label}. ${bucket.description}`];
    const embedded: Float32Array[] = [];
    for (const text of prototypes) {
      embedded.push(await embedText(text));
    }
    vectors.push({ id: bucket.id, vectors: embedded });
  }
  bucketVectors = vectors;
}

export type Classification = {
  primary: BucketId;
  primaryScore: number;
  secondary: { id: BucketId; score: number }[];
  scores: Record<BucketId, number>;
  leadScore: number;
  suppressed: boolean;
  /** Max cosine to any non-noise bucket */
  signalScore: number;
  /** Max cosine to noise/hype prototypes */
  noiseScore: number;
  /** Stage-1 gate sent this to noise (shill, OOD, or below floor) */
  gatedAsNoise: boolean;
};

export function buildClassificationDocument(input: {
  text: string;
  authorName?: string;
  authorUsername?: string;
  authorBio?: string;
}): string {
  const parts = [
    input.text.trim(),
    input.authorBio ? `Author bio: ${input.authorBio.trim()}` : "",
    input.authorUsername
      ? `Author: @${input.authorUsername}${input.authorName ? ` (${input.authorName})` : ""}`
      : "",
  ].filter(Boolean);
  return parts.join("\n");
}

export async function classifyText(document: string): Promise<Classification> {
  await ensureBucketVectors();
  const vector = await embedText(document.slice(0, 2000));

  const scores = {} as Record<BucketId, number>;
  const ranked: { id: BucketId; score: number }[] = [];

  for (const bucket of bucketVectors!) {
    let best = -1;
    for (const prototype of bucket.vectors) {
      best = Math.max(best, cosine(vector, prototype));
    }
    scores[bucket.id] = best;
    ranked.push({ id: bucket.id, score: best });
  }

  ranked.sort((a, b) => b.score - a.score);

  const noiseScore = scores.noise_retail_hype ?? 0;
  const contentRanked = ranked.filter((r) => r.id !== "noise_retail_hype");
  const bestContent = contentRanked[0] ?? {
    id: "noise_retail_hype" as BucketId,
    score: 0,
  };
  const signalScore = bestContent.score;

  // Stage 1 — builder/pad vs hype/OOD. One extra comparison, same embeddings.
  const belowFloor = signalScore < SIGNAL_FLOOR;
  const noiseWins = noiseScore >= signalScore + NOISE_GATE_MARGIN;
  const gatedAsNoise = belowFloor || noiseWins;

  const primary = gatedAsNoise
    ? { id: "noise_retail_hype" as BucketId, score: Math.max(noiseScore, signalScore) }
    : bestContent;

  const secondary = gatedAsNoise
    ? []
    : contentRanked
        .filter(
          (r) =>
            r.id !== primary.id &&
            r.score >= SIGNAL_FLOOR &&
            primary.score - r.score <= SECONDARY_MARGIN,
        )
        .slice(0, 2);

  const bucket = BUCKET_BY_ID[primary.id];
  const suppressed = Boolean(bucket.suppress);

  let leadScore = 0;
  if (!suppressed) {
    leadScore = bucket.leadWeight * primary.score;
    for (const s of secondary) {
      const w = BUCKET_BY_ID[s.id].leadWeight;
      if (!BUCKET_BY_ID[s.id].suppress) {
        leadScore += 0.15 * w * s.score;
      }
    }
  }

  return {
    primary: primary.id,
    primaryScore: primary.score,
    secondary,
    scores,
    leadScore: Number(leadScore.toFixed(4)),
    suppressed,
    signalScore,
    noiseScore,
    gatedAsNoise,
  };
}

/** Warm the model + bucket embeddings once (first run downloads BGE-small). */
export async function warmupClassifier(): Promise<void> {
  await ensureBucketVectors();
}

/**
 * Full post classification: semantic BGE pass, then the official-handle
 * override — official Meteora accounts always land in their own lane
 * (context, not leads) regardless of content.
 */
export async function classifyPost(input: {
  text: string;
  authorName?: string;
  authorUsername?: string;
  authorBio?: string;
}): Promise<Classification> {
  const c = await classifyText(buildClassificationDocument(input));
  if (isRetailFeedSpam(input.text, input.authorUsername)) {
    return {
      ...c,
      primary: "noise_retail_hype",
      leadScore: 0,
      suppressed: true,
      gatedAsNoise: true,
    };
  }
  if (
    input.authorUsername &&
    OFFICIAL_HANDLES.has(input.authorUsername.toLowerCase())
  ) {
    return {
      ...c,
      primary: "official_meteora",
      leadScore: 0,
      suppressed: false,
      gatedAsNoise: false,
    };
  }
  return c;
}

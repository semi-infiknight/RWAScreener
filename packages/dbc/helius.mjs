/**
 * Minimal Helius JSON-RPC helpers (no SDK required for the walk itself).
 */

export function heliusRpcUrl(apiKey) {
  return `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function heliusRpc(apiKey, method, params, { retries = 8 } = {}) {
  const url = heliusRpcUrl(apiKey);
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const text = await res.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        const transient =
          res.status === 429 ||
          res.status >= 500 ||
          /too many requests|rate limit|temporar|timeout/i.test(text);
        if (transient && attempt < retries) {
          await sleep(500 * 2 ** Math.min(attempt, 6) + Math.floor(Math.random() * 200));
          continue;
        }
        throw new Error(`Helius ${method}: HTTP ${res.status}, non-JSON: ${text.slice(0, 180)}`);
      }
      if (body.error) {
        const msg = body.error.message || JSON.stringify(body.error);
        if (
          (/rate limit|429|temporar|timeout|ECONNRESET|503|502|busy/i.test(msg) ||
            body.error.code === -32429) &&
          attempt < retries
        ) {
          await sleep(500 * 2 ** Math.min(attempt, 6) + Math.floor(Math.random() * 200));
          continue;
        }
        const err = new Error(`Helius ${method}: ${msg}`);
        err.code = body.error.code;
        throw err;
      }
      return body.result;
    } catch (e) {
      lastErr = e;
      if (
        attempt < retries &&
        /fetch|network|ECONN|ETIMEDOUT|Too Many|429|non-JSON/i.test(String(e?.message || e))
      ) {
        await sleep(500 * 2 ** Math.min(attempt, 6) + Math.floor(Math.random() * 200));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

/** Simple concurrency pool. */
export async function mapPool(items, concurrency, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  const n = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

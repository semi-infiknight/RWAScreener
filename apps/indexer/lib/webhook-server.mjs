import http from "node:http";

/**
 * Minimal Helius webhook stub (SPEC §5.3).
 * Fast ACK; optional HELIUS_WEBHOOK_SECRET; enqueues ingest_jobs when DATABASE_URL set.
 * Never invents pools from webhook body in this stub.
 */
export function startWebhookServer(opts = {}) {
  const port = Number(opts.port || process.env.PORT || 8080);
  const pool = opts.pool || null;
  const secret = (process.env.HELIUS_WEBHOOK_SECRET || "").trim();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, service: "rwascreener-indexer", stub: true }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/webhooks/helius") {
      if (secret) {
        const auth = req.headers.authorization || req.headers["x-helius-secret"] || "";
        const token = String(auth).replace(/^Bearer\s+/i, "").trim();
        if (token !== secret) {
          res.writeHead(401, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "unauthorized" }));
          return;
        }
      }

      const chunks = [];
      for await (const c of req) chunks.push(c);
      let payload = null;
      try {
        payload = JSON.parse(Buffer.concat(chunks).toString("utf8") || "null");
      } catch {
        payload = null;
      }

      const events = Array.isArray(payload)
        ? payload.length
        : payload && typeof payload === "object"
          ? 1
          : 0;

      if (pool) {
        try {
          await pool.query(
            `INSERT INTO ingest_jobs (kind, payload, status)
             VALUES ('helius_webhook', $1::jsonb, 'pending')`,
            [JSON.stringify({ received_at: new Date().toISOString(), events, stub: true })],
          );
        } catch (err) {
          console.warn("[indexer] webhook enqueue failed", err?.message || err);
        }
      }

      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          accepted: true,
          stub: true,
          events,
          note: "ACK only — pool upsert from webhook not yet decoded",
        }),
      );
      return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "not_found" }));
  });

  server.listen(port, () => {
    console.log(
      JSON.stringify({
        ok: true,
        listening: port,
        routes: ["GET /health", "POST /api/webhooks/helius"],
      }),
    );
  });

  return server;
}

import { NextRequest, NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/http-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Staging Helius webhook stub — fast ACK; optional secret. */
export async function POST(req: NextRequest) {
  const secret = (process.env.HELIUS_WEBHOOK_SECRET || "").trim();
  if (secret) {
    const auth =
      req.headers.get("authorization") ||
      req.headers.get("x-helius-webhook-secret") ||
      "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    if (token !== secret) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401, headers: noStoreHeaders() },
      );
    }
  }
  let payload: unknown = null;
  try {
    payload = await req.json();
  } catch {
    payload = null;
  }
  const events = Array.isArray(payload)
    ? payload.length
    : payload && typeof payload === "object"
      ? 1
      : 0;
  return NextResponse.json(
    { ok: true, accepted: true, stub: true, events },
    { status: 200, headers: noStoreHeaders() },
  );
}

export async function GET() {
  return NextResponse.json(
    { ok: true, endpoint: "/api/staging/webhooks/helius", methods: ["POST"], stub: true },
    { headers: noStoreHeaders() },
  );
}

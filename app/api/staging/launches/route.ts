import { NextRequest, NextResponse } from "next/server";
import { getLaunches } from "@/lib/staging";
import { noStoreHeaders } from "@/lib/http-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const limitRaw = Number(sp.get("limit") || "200");
  const result = await getLaunches({
    limit: Number.isFinite(limitRaw) ? limitRaw : 200,
    quote_mint: sp.get("quote_mint")?.trim() || null,
    fee_claimer: sp.get("fee_claimer")?.trim() || null,
  });
  return NextResponse.json(
    { ok: true, ...result.meta, launches: result.launches },
    { headers: noStoreHeaders() },
  );
}

import { NextResponse } from "next/server";
import { getQuotes } from "@/lib/staging";
import { noStoreHeaders } from "@/lib/http-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const result = await getQuotes();
  return NextResponse.json(
    { ok: true, ...result.meta, quotes: result.quotes },
    { headers: noStoreHeaders() },
  );
}

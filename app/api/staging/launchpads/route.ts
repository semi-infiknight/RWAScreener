import { NextResponse } from "next/server";
import { getLaunchpads } from "@/lib/staging";
import { noStoreHeaders } from "@/lib/http-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const result = await getLaunchpads();
  return NextResponse.json(
    { ok: true, ...result.meta, launchpads: result.launchpads },
    { headers: noStoreHeaders() },
  );
}

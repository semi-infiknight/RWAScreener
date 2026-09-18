import { NextResponse } from "next/server";
import { PAD_JSON_CACHE_CONTROL, PAD_JSON_NO_STORE } from "../../../../lib/http-cache";
import { loadPlatformTokensCached } from "../../../../lib/platform-tokens";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const tokens = await loadPlatformTokensCached();
    const res = NextResponse.json({
      count: Object.keys(tokens).length,
      tokens,
    });
    res.headers.set("Cache-Control", PAD_JSON_CACHE_CONTROL);
    return res;
  } catch (err) {
    console.error("[platform-tokens]", err);
    const res = NextResponse.json({ count: 0, tokens: {} });
    res.headers.set("Cache-Control", PAD_JSON_NO_STORE);
    return res;
  }
}

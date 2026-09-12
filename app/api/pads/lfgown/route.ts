import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Placeholder until this pad's site API is reverse-engineered. */
export async function GET() {
  return NextResponse.json({
    source: null,
    pending: true,
    count: 0,
    tokens: [],
  });
}

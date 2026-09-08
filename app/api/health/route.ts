import { NextResponse } from "next/server";
import { isJackettConfigured } from "@/lib/indexers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    jackettConfigured: isJackettConfigured(),
    time: new Date().toISOString(),
  });
}

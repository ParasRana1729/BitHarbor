import { NextResponse } from "next/server";
import { CATEGORIES } from "@/lib/categories";
import { PROVIDER_IDS } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    providers: PROVIDER_IDS,
    categories: CATEGORIES.map((c) => c.id),
    time: new Date().toISOString(),
  });
}

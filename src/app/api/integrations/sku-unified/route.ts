import { NextResponse } from "next/server";

import { fetchUnifiedSku } from "@/lib/integrations/sku-unified/unified-sku";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await fetchUnifiedSku();

    const httpStatus =
      result.status === "error" ? 503 : result.status === "partial" ? 207 : 200;

    return NextResponse.json(result, { status: httpStatus });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        source: "sku-unified",
        fetchedAt: new Date().toISOString(),
        status: "error",
        message: `Internal error: ${message}`,
        error: {
          code: "INTERNAL_ERROR",
          message,
        },
      },
      { status: 500 },
    );
  }
}

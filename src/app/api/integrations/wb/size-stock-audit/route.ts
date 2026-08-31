import { NextResponse } from "next/server";

import { runWbSizeStockAudit } from "@/lib/integrations/wb/size-stock-audit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await runWbSizeStockAudit();

    const httpStatus =
      result.status === "not_configured"
        ? 503
        : result.status === "error"
          ? 502
          : result.status === "partial"
            ? 207
            : 200;

    return NextResponse.json(result, { status: httpStatus });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        source: "wildberries-size-stock-audit",
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

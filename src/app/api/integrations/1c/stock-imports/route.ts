import { listStockImports } from "@/lib/integrations/1c/stock-latest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const imports = await listStockImports();

    return Response.json({
      source: "1c",
      status: "ok",
      fetchedAt: new Date().toISOString(),
      imports,
    });
  } catch (error) {
    return Response.json(
      {
        source: "1c",
        status: "error",
        fetchedAt: new Date().toISOString(),
        imports: [],
        error: {
          code: "DATABASE_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Не удалось загрузить историю импортов остатков",
        },
      },
      { status: 500 },
    );
  }
}

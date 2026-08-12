import { fetchRecentSkuImports } from "@/lib/integrations/1c/sku-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const imports = await fetchRecentSkuImports(10);

    return Response.json({
      source: "1c",
      status: "ok",
      fetchedAt: new Date().toISOString(),
      items: imports,
    });
  } catch (error) {
    return Response.json(
      {
        source: "1c",
        status: "error",
        fetchedAt: new Date().toISOString(),
        message:
          error instanceof Error
            ? error.message
            : "Не удалось загрузить историю импортов",
        items: [],
      },
      { status: 502 },
    );
  }
}

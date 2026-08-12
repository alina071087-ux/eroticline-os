import type { SkuItemsQuery } from "@/lib/integrations/1c/import-types";
import { fetchSkuCatalogItems } from "@/lib/integrations/1c/sku-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function readQueryParam(
  params: URLSearchParams,
  key: string,
): string | undefined {
  const value = params.get(key);
  return value?.trim() ? value.trim() : undefined;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const query: SkuItemsQuery = {
    search: readQueryParam(params, "search"),
    article: readQueryParam(params, "article"),
    color: readQueryParam(params, "color"),
    size: readQueryParam(params, "size"),
    matchStatus: readQueryParam(params, "matchStatus"),
    platform: (readQueryParam(params, "platform") ??
      "all") as SkuItemsQuery["platform"],
    onlyWithoutWb: params.get("onlyWithoutWb") === "true",
    onlyWithoutOzon: params.get("onlyWithoutOzon") === "true",
  };

  try {
    const items = await fetchSkuCatalogItems(query);

    return Response.json({
      source: "1c",
      status: "ok",
      fetchedAt: new Date().toISOString(),
      count: items.length,
      items,
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
            : "Не удалось загрузить справочник SKU",
        count: 0,
        items: [],
      },
      { status: 502 },
    );
  }
}

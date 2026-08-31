import { fetchLatestStockSnapshot } from "@/lib/integrations/1c/stock-latest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const result = await fetchLatestStockSnapshot();

  const status =
    result.status === "ok"
      ? 200
      : result.status === "not_found"
        ? 404
        : 500;

  return Response.json(result, { status });
}

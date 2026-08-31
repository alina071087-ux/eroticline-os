import { previewOneCStockImport } from "@/lib/integrations/1c/stock-import-preview";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const result = await previewOneCStockImport();

  return Response.json(result, {
    status: result.status === "error" ? 422 : 200,
  });
}

import { commitOneCStockImport } from "@/lib/integrations/1c/stock-import-commit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const result = await commitOneCStockImport();

  const status =
    result.status === "ok"
      ? 200
      : result.error?.code === "ALREADY_IMPORTED"
        ? 409
        : 422;

  return Response.json(result, { status });
}

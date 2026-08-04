import { fetchOzonProducts } from "@/lib/integrations/ozon/products";
import { httpStatusForOzonResult } from "@/lib/integrations/ozon/http-status";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await fetchOzonProducts();

  return Response.json(result, {
    status: httpStatusForOzonResult(result.status),
  });
}

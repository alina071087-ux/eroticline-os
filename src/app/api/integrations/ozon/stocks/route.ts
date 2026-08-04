import { fetchOzonStocks } from "@/lib/integrations/ozon/stocks";
import { httpStatusForOzonResult } from "@/lib/integrations/ozon/http-status";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await fetchOzonStocks();

  return Response.json(result, {
    status: httpStatusForOzonResult(result.status),
  });
}

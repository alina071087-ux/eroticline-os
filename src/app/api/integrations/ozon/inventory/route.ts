import { fetchOzonInventory } from "@/lib/integrations/ozon/inventory";
import { httpStatusForOzonResult } from "@/lib/integrations/ozon/http-status";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await fetchOzonInventory();

  return Response.json(result, {
    status: httpStatusForOzonResult(result.status),
  });
}

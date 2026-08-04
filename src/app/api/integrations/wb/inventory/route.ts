import { fetchWbInventory } from "@/lib/integrations/wb/inventory";

export const dynamic = "force-dynamic";

function httpStatusForResult(
  status: Awaited<ReturnType<typeof fetchWbInventory>>["status"],
): number {
  switch (status) {
    case "ok":
      return 200;
    case "not_configured":
      return 503;
    case "error":
    default:
      return 502;
  }
}

export async function GET() {
  const result = await fetchWbInventory();

  return Response.json(result, {
    status: httpStatusForResult(result.status),
  });
}

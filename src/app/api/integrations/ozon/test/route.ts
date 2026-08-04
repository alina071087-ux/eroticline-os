import { testOzonConnection } from "@/lib/integrations/ozon/test-connection";

export const dynamic = "force-dynamic";

function httpStatusForResult(
  result: Awaited<ReturnType<typeof testOzonConnection>>,
): number {
  if (result.status === "ok") {
    return 200;
  }

  if (!result.configured) {
    return 503;
  }

  return 502;
}

export async function GET() {
  const result = await testOzonConnection();

  return Response.json(result, {
    status: httpStatusForResult(result),
  });
}

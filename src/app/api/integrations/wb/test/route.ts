import { testWbConnection } from "@/lib/integrations/wb/test-connection";

export const dynamic = "force-dynamic";

function httpStatusForResult(status: Awaited<
  ReturnType<typeof testWbConnection>
>["status"]): number {
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
  const result = await testWbConnection();

  return Response.json(result, {
    status: httpStatusForResult(result.status),
  });
}

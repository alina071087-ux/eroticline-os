import { testSupabaseConnection } from "@/lib/integrations/supabase/test-connection";

export const dynamic = "force-dynamic";

function httpStatusForResult(
  result: Awaited<ReturnType<typeof testSupabaseConnection>>,
): number {
  if (result.status === "ok") {
    return 200;
  }

  if (!result.configured) {
    return 503;
  }

  if (result.error?.code === "TIMEOUT") {
    return 504;
  }

  if (result.error?.code === "NETWORK_ERROR") {
    return 502;
  }

  return 502;
}

export async function GET() {
  const result = await testSupabaseConnection();

  return Response.json(result, {
    status: httpStatusForResult(result),
  });
}

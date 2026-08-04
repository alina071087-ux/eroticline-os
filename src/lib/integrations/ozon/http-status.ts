import type { OzonIntegrationStatus } from "@/lib/integrations/ozon/types";

export function httpStatusForOzonResult(status: OzonIntegrationStatus): number {
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

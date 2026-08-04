import "server-only";

import type { IntegrationError } from "@/lib/integrations/types";

export function mapOzonHttpError(
  status: number,
  networkError?: string,
): IntegrationError {
  if (networkError === "TIMEOUT") {
    return {
      code: "TIMEOUT",
      message: "Превышено время ожидания ответа Ozon Seller API",
    };
  }

  if (networkError === "NETWORK_ERROR") {
    return {
      code: "NETWORK_ERROR",
      message: "Ozon Seller API недоступен",
    };
  }

  if (status === 401) {
    return {
      code: "INVALID_TOKEN",
      message: "Неверный Client-Id или Api-Key Ozon",
    };
  }

  if (status === 403) {
    return {
      code: "FORBIDDEN",
      message: "Недостаточно прав для доступа к Ozon Seller API",
    };
  }

  if (status === 429) {
    return {
      code: "RATE_LIMIT",
      message: "Превышен лимит запросов Ozon Seller API",
    };
  }

  return {
    code: "API_ERROR",
    message: `Ozon Seller API вернул HTTP ${status}`,
  };
}

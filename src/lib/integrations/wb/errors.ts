import "server-only";

import type { IntegrationError } from "@/lib/integrations/types";

export function mapWbHttpError(
  status: number,
  networkError?: string,
): IntegrationError {
  if (networkError === "TIMEOUT") {
    return {
      code: "TIMEOUT",
      message: "Превышено время ожидания ответа Wildberries API",
    };
  }

  if (networkError === "NETWORK_ERROR") {
    return {
      code: "NETWORK_ERROR",
      message: "Wildberries API недоступен",
    };
  }

  if (status === 401) {
    return {
      code: "INVALID_TOKEN",
      message: "Неверный или просроченный токен Wildberries",
    };
  }

  if (status === 403) {
    return {
      code: "FORBIDDEN",
      message: "Недостаточно прав для доступа к Wildberries API",
    };
  }

  if (status === 429) {
    return {
      code: "RATE_LIMIT",
      message: "Превышен лимит запросов Wildberries API",
    };
  }

  return {
    code: "API_ERROR",
    message: `Wildberries API вернул HTTP ${status}`,
  };
}

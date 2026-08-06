import "server-only";

import type { WbProductsResult } from "@/lib/integrations/types";
import { fetchAllWbProductCards } from "@/lib/integrations/wb/product-cards";

function buildResult(
  partial: Omit<WbProductsResult, "source" | "fetchedAt">,
): WbProductsResult {
  return {
    source: "wildberries",
    fetchedAt: new Date().toISOString(),
    ...partial,
  };
}

export async function fetchWbProducts(): Promise<WbProductsResult> {
  const scan = await fetchAllWbProductCards();

  if (scan.error && scan.cards.size === 0) {
    return buildResult({
      status: "error",
      configured: scan.error.code !== "MISSING_TOKEN",
      httpStatus: scan.httpStatus,
      durationMs: scan.durationMs,
      message: scan.error.message,
      error: scan.error,
    });
  }

  if (scan.cards.size === 0) {
    return buildResult({
      status: "error",
      configured: true,
      httpStatus: scan.httpStatus,
      durationMs: scan.durationMs,
      count: 0,
      message: "Wildberries API вернул пустой список карточек",
      error: {
        code: "EMPTY_RESPONSE",
        message: "Wildberries API вернул пустой список карточек",
      },
    });
  }

  const products = [...scan.cards.values()].sort((left, right) => left.nmID - right.nmID);
  const partialNote =
    scan.error || scan.trashError || !scan.isComplete
      ? " Загружена часть карточек или есть ошибки сканирования."
      : "";

  return buildResult({
    status: "ok",
    configured: true,
    httpStatus: scan.httpStatus,
    durationMs: scan.durationMs,
    count: products.length,
    message: `Получено карточек: ${products.length} (активные: ${scan.activeNmIds.size}, корзина: ${scan.trashNmIds.size}).${partialNote}`,
    products,
  });
}

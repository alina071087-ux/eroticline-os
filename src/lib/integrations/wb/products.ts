import "server-only";

import type {
  WbProductCard,
  WbProductSize,
  WbProductsResult,
} from "@/lib/integrations/types";
import { getWbApiToken } from "@/lib/integrations/wb/config";
import { WbClient } from "@/lib/integrations/wb/client";
import { mapWbHttpError } from "@/lib/integrations/wb/errors";

const MAX_PRODUCTS = 20;

function buildResult(
  partial: Omit<WbProductsResult, "source" | "fetchedAt">,
): WbProductsResult {
  return {
    source: "wildberries",
    fetchedAt: new Date().toISOString(),
    ...partial,
  };
}

function normalizeSize(raw: unknown): WbProductSize | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const size = raw as Record<string, unknown>;
  const chrtID = size.chrtID;

  if (typeof chrtID !== "number") {
    return null;
  }

  const skus = Array.isArray(size.skus)
    ? size.skus.filter((sku): sku is string => typeof sku === "string")
    : [];

  return {
    chrtID,
    techSize: typeof size.techSize === "string" ? size.techSize : "",
    barcodes: skus,
  };
}

function normalizeCard(raw: unknown): WbProductCard | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const card = raw as Record<string, unknown>;
  const nmID = card.nmID;

  if (typeof nmID !== "number") {
    return null;
  }

  const sizes = Array.isArray(card.sizes)
    ? card.sizes
        .map(normalizeSize)
        .filter((size): size is WbProductSize => size !== null)
    : [];

  return {
    nmID,
    vendorCode: typeof card.vendorCode === "string" ? card.vendorCode : "",
    title: typeof card.title === "string" ? card.title : "",
    brand: typeof card.brand === "string" ? card.brand : "",
    subjectName: typeof card.subjectName === "string" ? card.subjectName : "",
    sizes,
  };
}

function extractCards(data: unknown): unknown[] {
  if (!data || typeof data !== "object") {
    return [];
  }

  const record = data as Record<string, unknown>;

  if (Array.isArray(record.cards)) {
    return record.cards;
  }

  if (record.data && typeof record.data === "object") {
    const nested = record.data as Record<string, unknown>;
    if (Array.isArray(nested.cards)) {
      return nested.cards;
    }
  }

  return [];
}

export async function fetchWbProducts(
  limit = MAX_PRODUCTS,
): Promise<WbProductsResult> {
  const token = getWbApiToken();
  const safeLimit = Math.min(Math.max(1, limit), MAX_PRODUCTS);

  if (!token) {
    return buildResult({
      status: "not_configured",
      configured: false,
      message: "Токен Wildberries не настроен",
      error: {
        code: "MISSING_TOKEN",
        message:
          "Переменная окружения WB_API_TOKEN не задана. Добавьте её в .env.local",
      },
    });
  }

  const client = new WbClient(token);
  const response = await client.getProductCards(safeLimit);

  if (response.error) {
    const error = mapWbHttpError(response.status, response.error);
    return buildResult({
      status: "error",
      configured: true,
      httpStatus: response.status || undefined,
      durationMs: response.durationMs,
      message: error.message,
      error,
    });
  }

  if (!response.ok) {
    const error = mapWbHttpError(response.status);
    return buildResult({
      status: "error",
      configured: true,
      httpStatus: response.status,
      durationMs: response.durationMs,
      message: error.message,
      error,
    });
  }

  const rawCards = extractCards(response.data);
  const products = rawCards
    .map(normalizeCard)
    .filter((card): card is WbProductCard => card !== null)
    .slice(0, safeLimit);

  if (products.length === 0) {
    return buildResult({
      status: "error",
      configured: true,
      httpStatus: response.status,
      durationMs: response.durationMs,
      count: 0,
      message: "Wildberries API вернул пустой список карточек",
      error: {
        code: "EMPTY_RESPONSE",
        message: "Wildberries API вернул пустой список карточек",
      },
    });
  }

  return buildResult({
    status: "ok",
    configured: true,
    httpStatus: response.status,
    durationMs: response.durationMs,
    count: products.length,
    message: `Получено карточек: ${products.length}`,
    products,
  });
}

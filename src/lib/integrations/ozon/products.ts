import "server-only";

import type { IntegrationError } from "@/lib/integrations/types";
import { OzonClient } from "@/lib/integrations/ozon/client";
import { getOzonCredentials } from "@/lib/integrations/ozon/config";
import { mapOzonHttpError } from "@/lib/integrations/ozon/errors";
import {
  chunkArray,
  extractResult,
  OZON_INFO_LIST_BATCH_SIZE,
  OZON_MAX_PAGES,
  OZON_MAX_PRODUCTS,
  OZON_PRODUCT_LIST_PAGE_SIZE,
  readProductId,
  readString,
} from "@/lib/integrations/ozon/helpers";
import type { OzonRequestDiagnostic } from "@/lib/integrations/ozon/diagnostics";
import { buildOzonRequestDiagnostic } from "@/lib/integrations/ozon/diagnostics";
import type { OzonProduct, OzonProductsResult } from "@/lib/integrations/ozon/types";

type ListItem = {
  productId: number;
  offerId: string;
  archived: boolean;
};

function buildResult(
  partial: Omit<OzonProductsResult, "source" | "fetchedAt">,
): OzonProductsResult {
  return {
    source: "ozon",
    fetchedAt: new Date().toISOString(),
    ...partial,
  };
}

function notConfiguredResult(): OzonProductsResult {
  return buildResult({
    status: "not_configured",
    configured: false,
    message: "Учётные данные Ozon не настроены",
    totalProducts: 0,
    pagesLoaded: 0,
    isComplete: false,
    error: {
      code: "MISSING_CREDENTIALS",
      message:
        "Переменные окружения OZON_CLIENT_ID и OZON_API_KEY не заданы. Добавьте их в .env.local",
    },
  });
}

function extractListItems(data: unknown): {
  items: ListItem[];
  lastId?: string;
} {
  const result = extractResult(data);
  const rawItems = Array.isArray(result?.items) ? result.items : [];
  const items: ListItem[] = [];

  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object") {
      continue;
    }

    const item = raw as Record<string, unknown>;
    const productId = readProductId(item.product_id ?? item.productId);

    if (productId === null) {
      continue;
    }

    items.push({
      productId,
      offerId: readString(item.offer_id ?? item.offerId),
      archived: item.archived === true,
    });
  }

  const lastId = readString(result?.last_id ?? result?.lastId);

  return {
    items,
    lastId: lastId || undefined,
  };
}

function extractInfoItems(data: unknown): unknown[] {
  const result = extractResult(data);

  if (Array.isArray(result?.items)) {
    return result.items;
  }

  if (Array.isArray((data as Record<string, unknown> | null)?.items)) {
    return (data as Record<string, unknown>).items as unknown[];
  }

  return [];
}

function readSku(item: Record<string, unknown>): number | undefined {
  const directSku = readProductId(item.sku);
  if (directSku !== null) {
    return directSku;
  }

  const sources = item.sources;
  if (!Array.isArray(sources)) {
    return undefined;
  }

  for (const source of sources) {
    if (!source || typeof source !== "object") {
      continue;
    }

    const sku = readProductId((source as Record<string, unknown>).sku);
    if (sku !== null) {
      return sku;
    }
  }

  return undefined;
}

function readStatus(item: Record<string, unknown>): string | undefined {
  const status = item.status;

  if (!status || typeof status !== "object") {
    return undefined;
  }

  const statusRecord = status as Record<string, unknown>;
  const stateName = readString(statusRecord.state_name);
  if (stateName) {
    return stateName;
  }

  const state = readString(statusRecord.state);
  return state || undefined;
}

function readBarcodes(item: Record<string, unknown>): {
  barcode?: string;
  barcodes?: string[];
} {
  const barcodes = Array.isArray(item.barcodes)
    ? item.barcodes.filter((value): value is string => typeof value === "string")
    : [];

  const barcode = readString(item.barcode);

  if (barcodes.length > 0) {
    return {
      barcode: barcodes[0],
      barcodes,
    };
  }

  if (barcode) {
    return { barcode, barcodes: [barcode] };
  }

  return {};
}

function normalizeInfoItem(raw: unknown): OzonProduct | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const item = raw as Record<string, unknown>;
  const productId = readProductId(item.id ?? item.product_id ?? item.productId);

  if (productId === null) {
    return null;
  }

  const barcodeData = readBarcodes(item);
  const sku = readSku(item);

  return {
    productId,
    offerId: readString(item.offer_id ?? item.offerId),
    name: readString(item.name),
    ...barcodeData,
    sku,
    status: readStatus(item),
    archived: item.is_archived === true || item.archived === true,
  };
}

function mergeListAndInfo(
  listItems: ListItem[],
  infoProducts: OzonProduct[],
): OzonProduct[] {
  const infoByProductId = new Map(
    infoProducts.map((product) => [product.productId, product]),
  );

  return listItems.map((listItem) => {
    const info = infoByProductId.get(listItem.productId);

    if (!info) {
      return {
        productId: listItem.productId,
        offerId: listItem.offerId,
        name: "",
        archived: listItem.archived,
      };
    }

    return {
      ...info,
      offerId: info.offerId || listItem.offerId,
      archived: info.archived || listItem.archived,
    };
  });
}

export async function fetchOzonProducts(): Promise<OzonProductsResult> {
  const credentials = getOzonCredentials();

  if (!credentials) {
    return notConfiguredResult();
  }

  const client = new OzonClient(credentials.clientId, credentials.apiKey);
  const listItems: ListItem[] = [];
  let pagesLoaded = 0;
  let durationMs = 0;
  let lastHttpStatus: number | undefined;
  let lastId: string | undefined;
  let stoppedEarly = false;
  let lastError: IntegrationError | undefined;
  const diagnostics: OzonRequestDiagnostic[] = [];

  while (pagesLoaded < OZON_MAX_PAGES && listItems.length < OZON_MAX_PRODUCTS) {
    const listBody: Record<string, unknown> = {
      filter: { visibility: "ALL" },
      limit: OZON_PRODUCT_LIST_PAGE_SIZE,
    };

    if (lastId) {
      listBody.last_id = lastId;
    }

    const response = await client.getProductList(
      OZON_PRODUCT_LIST_PAGE_SIZE,
      lastId,
    );

    pagesLoaded += 1;
    durationMs += response.durationMs;
    lastHttpStatus = response.status || lastHttpStatus;

    if (response.error || !response.ok) {
      lastError = mapOzonHttpError(response.status, response.error);
      diagnostics.push(
        buildOzonRequestDiagnostic({
          endpoint: "/v3/product/list",
          httpStatus: response.status,
          durationMs: response.durationMs,
          requestBody: listBody,
          responseData: response.data,
        }),
      );
      stoppedEarly = true;
      break;
    }

    const page = extractListItems(response.data);

    if (page.items.length === 0) {
      break;
    }

    listItems.push(...page.items);

    if (listItems.length >= OZON_MAX_PRODUCTS) {
      stoppedEarly = true;
      break;
    }

    if (page.items.length < OZON_PRODUCT_LIST_PAGE_SIZE || !page.lastId) {
      break;
    }

    if (page.lastId === lastId) {
      stoppedEarly = true;
      break;
    }

    lastId = page.lastId;
  }

  if (listItems.length === 0) {
    if (lastError) {
      return buildResult({
        status: "error",
        configured: true,
        httpStatus: lastHttpStatus,
        durationMs,
        totalProducts: 0,
        pagesLoaded,
        isComplete: false,
        message: lastError.message,
        error: lastError,
        diagnostics,
      });
    }

    return buildResult({
      status: "ok",
      configured: true,
      httpStatus: lastHttpStatus,
      durationMs,
      totalProducts: 0,
      pagesLoaded,
      isComplete: true,
      message: "Список товаров Ozon пуст",
      products: [],
    });
  }

  const infoProducts: OzonProduct[] = [];
  const productIds = listItems.map((item) => item.productId);
  let infoPagesLoaded = 0;

  for (const chunk of chunkArray(productIds, OZON_INFO_LIST_BATCH_SIZE)) {
    const infoBody = { product_id: chunk };
    const response = await client.getProductInfoList(chunk);
    durationMs += response.durationMs;
    lastHttpStatus = response.status || lastHttpStatus;
    infoPagesLoaded += 1;

    if (response.error || !response.ok) {
      lastError = mapOzonHttpError(response.status, response.error);
      diagnostics.push(
        buildOzonRequestDiagnostic({
          endpoint: "/v3/product/info/list",
          httpStatus: response.status,
          durationMs: response.durationMs,
          requestBody: infoBody,
          responseData: response.data,
        }),
      );
      stoppedEarly = true;
      break;
    }

    const normalized = extractInfoItems(response.data)
      .map(normalizeInfoItem)
      .filter((product): product is OzonProduct => product !== null);

    infoProducts.push(...normalized);
  }

  if (stoppedEarly && infoProducts.length === 0) {
    return buildResult({
      status: "error",
      configured: true,
      httpStatus: lastHttpStatus,
      durationMs,
      totalProducts: 0,
      pagesLoaded: pagesLoaded + infoPagesLoaded,
      isComplete: false,
      message: lastError?.message ?? "Не удалось получить товары Ozon",
      error: lastError,
      diagnostics,
    });
  }

  const products = mergeListAndInfo(listItems, infoProducts);
  const isComplete = !stoppedEarly;

  return buildResult({
    status: "ok",
    configured: true,
    httpStatus: lastHttpStatus,
    durationMs,
    totalProducts: products.length,
    pagesLoaded: pagesLoaded + infoPagesLoaded,
    isComplete,
    message: isComplete
      ? `Получено товаров: ${products.length}`
      : `Получена часть товаров: ${products.length}`,
    products,
    diagnostics: diagnostics.length > 0 ? diagnostics : undefined,
  });
}

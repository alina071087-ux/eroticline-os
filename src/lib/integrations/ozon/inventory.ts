import "server-only";

import { fetchOzonProducts } from "@/lib/integrations/ozon/products";
import { fetchOzonStocks } from "@/lib/integrations/ozon/stocks";
import type {
  OzonInventoryItem,
  OzonInventoryResult,
  OzonProduct,
  OzonStockItem,
  OzonStockTotals,
} from "@/lib/integrations/ozon/types";

function buildResult(
  partial: Omit<OzonInventoryResult, "source" | "fetchedAt">,
): OzonInventoryResult {
  return {
    source: "ozon",
    fetchedAt: new Date().toISOString(),
    ...partial,
  };
}

function buildProductIndexes(products: OzonProduct[]) {
  const byProductId = new Map<number, OzonProduct>();
  const byOfferId = new Map<string, OzonProduct>();

  for (const product of products) {
    byProductId.set(product.productId, product);

    if (product.offerId) {
      byOfferId.set(product.offerId, product);
    }
  }

  return { byProductId, byOfferId };
}

function resolveProduct(
  stock: OzonStockItem,
  byProductId: Map<number, OzonProduct>,
  byOfferId: Map<string, OzonProduct>,
): OzonProduct | undefined {
  const byId = byProductId.get(stock.productId);
  if (byId) {
    return byId;
  }

  if (stock.offerId) {
    return byOfferId.get(stock.offerId);
  }

  return undefined;
}

function mergeInventoryRow(
  stock: OzonStockItem,
  product: OzonProduct | undefined,
): OzonInventoryItem {
  const barcodeData = product?.barcodes?.length
    ? { barcodes: product.barcodes, barcode: product.barcode ?? product.barcodes[0] }
    : product?.barcode
      ? { barcode: product.barcode }
      : {};

  return {
    productId: stock.productId,
    offerId: stock.offerId || product?.offerId || "",
    name: product?.name || undefined,
    ...barcodeData,
    warehouseId: stock.warehouseId,
    warehouseName: stock.warehouseName,
    present: stock.present,
    reserved: stock.reserved,
    available: stock.available,
    productStatus: product?.status,
    matched: Boolean(product),
  };
}

function sumTotals(rows: OzonInventoryItem[]): OzonStockTotals {
  return rows.reduce(
    (totals, row) => ({
      present: totals.present + row.present,
      reserved: totals.reserved + row.reserved,
      available: totals.available + row.available,
    }),
    { present: 0, reserved: 0, available: 0 },
  );
}

export async function fetchOzonInventory(): Promise<OzonInventoryResult> {
  const [productsResult, stocksResult] = await Promise.all([
    fetchOzonProducts(),
    fetchOzonStocks(),
  ]);

  const partialErrors: OzonInventoryResult["partialErrors"] = {};

  if (productsResult.status === "not_configured") {
    return buildResult({
      status: "not_configured",
      configured: false,
      message: productsResult.message,
      error: productsResult.error,
    });
  }

  if (stocksResult.status === "not_configured") {
    return buildResult({
      status: "not_configured",
      configured: false,
      message: stocksResult.message,
      error: stocksResult.error,
    });
  }

  if (productsResult.error) {
    partialErrors.products = productsResult.error;
  }

  if (stocksResult.error) {
    partialErrors.stocks = stocksResult.error;
  }

  if (stocksResult.status === "error" && (stocksResult.stocks?.length ?? 0) === 0) {
    return buildResult({
      status: "error",
      configured: true,
      httpStatus: stocksResult.httpStatus ?? productsResult.httpStatus,
      durationMs: (productsResult.durationMs ?? 0) + (stocksResult.durationMs ?? 0),
      message: stocksResult.message ?? "Не удалось получить остатки Ozon",
      error: stocksResult.error,
      partialErrors:
        Object.keys(partialErrors).length > 0 ? partialErrors : undefined,
    });
  }

  const stocks = stocksResult.stocks ?? [];
  const products = productsResult.products ?? [];
  const { byProductId, byOfferId } = buildProductIndexes(products);

  if (stocks.length === 0) {
    return buildResult({
      status: "error",
      configured: true,
      httpStatus: stocksResult.httpStatus ?? productsResult.httpStatus,
      durationMs: (productsResult.durationMs ?? 0) + (stocksResult.durationMs ?? 0),
      totalInventoryRows: 0,
      totalUniqueProducts: 0,
      matchedProductsCount: 0,
      unmatchedProductsCount: 0,
      pagesLoaded:
        (productsResult.pagesLoaded ?? 0) + (stocksResult.pagesLoaded ?? 0),
      isComplete: false,
      totals: { present: 0, reserved: 0, available: 0 },
      message: "Нет данных об остатках для объединения",
      error: {
        code: "EMPTY_RESPONSE",
        message: "Ozon API вернул пустой список остатков",
      },
      partialErrors:
        Object.keys(partialErrors).length > 0 ? partialErrors : undefined,
    });
  }

  const items = stocks.map((stock) => {
    const product = resolveProduct(stock, byProductId, byOfferId);
    return mergeInventoryRow(stock, product);
  });

  const matchedProductIds = new Set<number>();
  const unmatchedProductIds = new Set<number>();

  for (const item of items) {
    if (item.matched) {
      matchedProductIds.add(item.productId);
    } else {
      unmatchedProductIds.add(item.productId);
    }
  }

  for (const productId of matchedProductIds) {
    unmatchedProductIds.delete(productId);
  }

  const isComplete =
    (productsResult.isComplete ?? false) && (stocksResult.isComplete ?? false);
  const totals = sumTotals(items);

  return buildResult({
    status: "ok",
    configured: true,
    httpStatus: stocksResult.httpStatus ?? productsResult.httpStatus,
    durationMs: (productsResult.durationMs ?? 0) + (stocksResult.durationMs ?? 0),
    totalInventoryRows: items.length,
    totalUniqueProducts: new Set(items.map((item) => item.productId)).size,
    matchedProductsCount: matchedProductIds.size,
    unmatchedProductsCount: unmatchedProductIds.size,
    pagesLoaded:
      (productsResult.pagesLoaded ?? 0) + (stocksResult.pagesLoaded ?? 0),
    isComplete,
    totals,
    message: `Объединено записей: ${items.length}. Сопоставлено товаров: ${matchedProductIds.size}/${new Set(items.map((item) => item.productId)).size}.`,
    partialErrors:
      Object.keys(partialErrors).length > 0 ? partialErrors : undefined,
    items,
  });
}

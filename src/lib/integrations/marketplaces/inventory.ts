import "server-only";

import { fetchOzonInventory } from "@/lib/integrations/ozon/inventory";
import { mergeMarketplaceInventory } from "@/lib/integrations/marketplaces/matching";
import type { MarketplaceInventoryResult } from "@/lib/integrations/marketplaces/types";
import { fetchWbInventory } from "@/lib/integrations/wb/inventory";
import { fetchWbProductCardsForNmIds } from "@/lib/integrations/wb/product-cards";

function buildResult(
  partial: Omit<MarketplaceInventoryResult, "source" | "fetchedAt">,
): MarketplaceInventoryResult {
  return {
    source: "marketplaces",
    fetchedAt: new Date().toISOString(),
    ...partial,
  };
}

function collectWbNmIds(
  items: NonNullable<Awaited<ReturnType<typeof fetchWbInventory>>["items"]>,
): Set<number> {
  return new Set(items.map((item) => item.nmID));
}

export async function fetchMarketplaceInventory(): Promise<MarketplaceInventoryResult> {
  const startedAt = Date.now();

  const [wbResult, ozonResult] = await Promise.all([
    fetchWbInventory(),
    fetchOzonInventory(),
  ]);

  const partialErrors: MarketplaceInventoryResult["partialErrors"] = {};
  const wbConfigured = wbResult.configured;
  const ozonConfigured = ozonResult.configured;

  if (!wbConfigured && !ozonConfigured) {
    return buildResult({
      status: "not_configured",
      configured: false,
      durationMs: Date.now() - startedAt,
      message: "Интеграции Wildberries и Ozon не настроены",
      error: {
        code: "MISSING_CREDENTIALS",
        message:
          "Добавьте WB_API_TOKEN и OZON_CLIENT_ID/OZON_API_KEY в .env.local",
      },
    });
  }

  const wbOk = wbResult.status === "ok";
  const ozonOk = ozonResult.status === "ok";

  if (!wbOk && !ozonOk) {
    if (wbResult.error) {
      partialErrors.wbInventory = wbResult.error;
    }

    if (ozonResult.error) {
      partialErrors.ozonInventory = ozonResult.error;
    }

    return buildResult({
      status: "error",
      configured: wbConfigured || ozonConfigured,
      durationMs: Date.now() - startedAt,
      message: "Не удалось загрузить остатки обеих площадок",
      error: wbResult.error ??
        ozonResult.error ?? {
          code: "API_ERROR",
          message: "Не удалось загрузить остатки маркетплейсов",
        },
      partialErrors,
    });
  }

  let wbCardsScan:
    | Awaited<ReturnType<typeof fetchWbProductCardsForNmIds>>
    | undefined;

  if (wbOk && wbResult.items?.length) {
    wbCardsScan = await fetchWbProductCardsForNmIds(collectWbNmIds(wbResult.items));

    if (wbCardsScan.error) {
      partialErrors.wbProducts = wbCardsScan.error;
    }

    if (wbCardsScan.trashError) {
      partialErrors.wbProducts = wbCardsScan.trashError;
    }
  }

  const wbItems = wbOk ? (wbResult.items ?? []) : [];
  const ozonItems = ozonOk ? (ozonResult.items ?? []) : [];
  const wbCards = wbCardsScan?.cards ?? new Map();

  const merged =
    wbItems.length > 0 || ozonItems.length > 0
      ? mergeMarketplaceInventory(wbItems, wbCards, ozonItems)
      : {
          items: [],
          matchQuality: {
            barcodeExact: 0,
            offerExact: 0,
            offerNormalized: 0,
            ambiguous: 0,
            wbOnly: 0,
            ozonOnly: 0,
            noIdentifier: 0,
            totalUnified: 0,
          },
          identifierAudit: {
            wbNmIdsWithStock: 0,
            wbNmIdsWithBarcode: 0,
            uniqueWbBarcodes: 0,
            uniqueOzonBarcodes: 0,
            barcodeIntersections: 0,
            offerExactIntersections: 0,
            offerNormalizedIntersections: 0,
            matchExamples: [],
            mismatchExamples: [],
          },
        };

  const wbWarehouses = new Set(wbItems.map((item) => item.warehouseName));

  const summary = {
    wbQuantity: wbItems.reduce((sum, item) => sum + item.quantity, 0),
    wbInWayToClient: wbItems.reduce(
      (sum, item) => sum + item.inWayToClient,
      0,
    ),
    wbInWayFromClient: wbItems.reduce(
      (sum, item) => sum + item.inWayFromClient,
      0,
    ),
    ozonPresent: ozonResult.totals?.present ?? 0,
    ozonReserved: ozonResult.totals?.reserved ?? 0,
    ozonAvailable: ozonResult.totals?.available ?? 0,
  };

  const hasPartialError = Boolean(
    !wbOk ||
      !ozonOk ||
      wbResult.isComplete === false ||
      ozonResult.isComplete === false ||
      wbCardsScan?.isComplete === false ||
      partialErrors.wbProducts ||
      partialErrors.wbInventory ||
      partialErrors.ozonInventory,
  );

  return buildResult({
    status: !wbOk && !ozonOk ? "error" : "ok",
    configured: wbConfigured || ozonConfigured,
    durationMs: Date.now() - startedAt,
    message: `Объединено товаров: ${merged.items.length}. Совпадений по штрихкоду: ${merged.matchQuality.barcodeExact}, по артикулу: ${merged.matchQuality.offerExact + merged.matchQuality.offerNormalized}.`,
    wb: wbOk
      ? {
          status: wbResult.status,
          configured: wbResult.configured,
          fetchedAt: wbResult.fetchedAt,
          isComplete:
            (wbResult.isComplete ?? false) &&
            (wbCardsScan?.isComplete ?? true),
          error: wbResult.error,
          quantity: summary.wbQuantity,
          inWayToClient: summary.wbInWayToClient,
          inWayFromClient: summary.wbInWayFromClient,
          productCount: wbResult.totalUniqueNmIds ?? collectWbNmIds(wbItems).size,
          warehouseCount: wbWarehouses.size,
        }
      : {
          status: wbResult.status,
          configured: wbResult.configured,
          fetchedAt: wbResult.fetchedAt ?? null,
          isComplete: false,
          error: wbResult.error,
          quantity: 0,
          inWayToClient: 0,
          inWayFromClient: 0,
          productCount: 0,
          warehouseCount: 0,
        },
    ozon: ozonOk
      ? {
          status: ozonResult.status,
          configured: ozonResult.configured,
          fetchedAt: ozonResult.fetchedAt,
          isComplete: ozonResult.isComplete ?? false,
          error: ozonResult.error,
          present: summary.ozonPresent,
          reserved: summary.ozonReserved,
          available: summary.ozonAvailable,
          productCount: ozonResult.totalUniqueProducts ?? 0,
          rowCount: ozonResult.totalInventoryRows ?? 0,
        }
      : {
          status: ozonResult.status,
          configured: ozonResult.configured,
          fetchedAt: ozonResult.fetchedAt ?? null,
          isComplete: false,
          error: ozonResult.error,
          present: 0,
          reserved: 0,
          available: 0,
          productCount: 0,
          rowCount: 0,
        },
    summary,
    matchQuality: merged.matchQuality,
    identifierAudit: merged.identifierAudit,
    items: merged.items,
    partialErrors: Object.keys(partialErrors).length > 0 ? partialErrors : undefined,
  });
}

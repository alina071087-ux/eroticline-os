import "server-only";

import type { OzonStockItem, OzonStockTypeTotals } from "@/lib/integrations/ozon/types";
import { computeAvailable } from "@/lib/integrations/ozon/helpers";

export type OzonStockTypeAuditEntry = OzonStockTypeTotals & {
  products: number;
};

export type OzonStockTypeAudit = {
  types: string[];
  byType: Record<string, OzonStockTypeAuditEntry>;
};

export function normalizeStockType(value: unknown): string {
  if (typeof value !== "string") {
    return "unknown";
  }

  const trimmed = value.trim().toLowerCase();
  return trimmed || "unknown";
}

export function buildTotalsByType(
  rows: OzonStockItem[],
): Record<string, OzonStockTypeTotals> {
  const map = new Map<string, OzonStockTypeTotals>();

  for (const row of rows) {
    const current = map.get(row.stockType) ?? {
      rows: 0,
      present: 0,
      reserved: 0,
      available: 0,
    };

    current.rows += 1;
    current.present += row.present;
    current.reserved += row.reserved;
    current.available += row.available;
    map.set(row.stockType, current);
  }

  return Object.fromEntries(
    [...map.entries()].sort(([left], [right]) => left.localeCompare(right)),
  );
}

export function auditStockTypes(rows: OzonStockItem[]): OzonStockTypeAudit {
  const byType: Record<string, OzonStockTypeAuditEntry> = {};
  const productIdsByType = new Map<string, Set<number>>();

  for (const row of rows) {
    const current = byType[row.stockType] ?? {
      rows: 0,
      present: 0,
      reserved: 0,
      available: 0,
      products: 0,
    };

    current.rows += 1;
    current.present += row.present;
    current.reserved += row.reserved;
    current.available += row.available;
    byType[row.stockType] = current;

    const productIds =
      productIdsByType.get(row.stockType) ?? new Set<number>();
    productIds.add(row.productId);
    productIdsByType.set(row.stockType, productIds);
  }

  for (const [stockType, productIds] of productIdsByType.entries()) {
    if (byType[stockType]) {
      byType[stockType].products = productIds.size;
    }
  }

  return {
    types: Object.keys(byType).sort(),
    byType,
  };
}

export function summarizeRawInfoStocks(items: unknown[]): OzonStockItem[] {
  const rows: OzonStockItem[] = [];

  for (const raw of items) {
    if (!raw || typeof raw !== "object") {
      continue;
    }

    const item = raw as Record<string, unknown>;
    const productIdRaw = item.product_id ?? item.productId;
    const productId =
      typeof productIdRaw === "number"
        ? productIdRaw
        : typeof productIdRaw === "string"
          ? Number(productIdRaw)
          : NaN;

    if (!Number.isFinite(productId) || productId <= 0) {
      continue;
    }

    const offerId =
      typeof item.offer_id === "string"
        ? item.offer_id
        : typeof item.offerId === "string"
          ? item.offerId
          : "";

    const stocks = Array.isArray(item.stocks) ? item.stocks : [];

    for (const stockRaw of stocks) {
      if (!stockRaw || typeof stockRaw !== "object") {
        continue;
      }

      const stock = stockRaw as Record<string, unknown>;
      const present =
        typeof stock.present === "number" && Number.isFinite(stock.present)
          ? stock.present
          : 0;
      const reserved =
        typeof stock.reserved === "number" && Number.isFinite(stock.reserved)
          ? stock.reserved
          : 0;

      rows.push({
        productId,
        offerId,
        present,
        reserved,
        available: computeAvailable(present, reserved),
        stockType: normalizeStockType(stock.type),
      });
    }
  }

  return rows;
}

import "server-only";

import { normalizeBarcodeValue } from "@/lib/integrations/1c/parser";
import type { WbProductCard, WbStockItem } from "@/lib/integrations/types";
import type { WbRawStockRow } from "@/lib/integrations/wb/raw-stocks";

export type WbChrtCatalogEntry = {
  nmId: number;
  chrtId: number;
  techSize: string;
  barcodes: string[];
  vendorCode: string;
  title: string;
  brand: string;
};

export type WbChrtWarehouseStock = {
  warehouseId: number | null;
  warehouseName: string;
  quantity: number;
  inWayToClient: number;
  inWayFromClient: number;
};

export type WbChrtStockAggregate = WbChrtCatalogEntry & {
  quantity: number;
  inWayToClient: number;
  inWayFromClient: number;
  warehouses: WbChrtWarehouseStock[];
};

export type WbWithout1cEntry = {
  chrtId: number;
  nmId: number;
  techSize: string;
  barcodes: string[];
  vendorCode: string;
  title: string;
  quantity: number;
  inWayToClient: number;
  inWayFromClient: number;
};

export function buildChrtCatalog(
  cards: WbProductCard[],
): Map<number, WbChrtCatalogEntry> {
  const map = new Map<number, WbChrtCatalogEntry>();

  for (const card of cards) {
    for (const size of card.sizes) {
      map.set(size.chrtID, {
        nmId: card.nmID,
        chrtId: size.chrtID,
        techSize: size.techSize,
        barcodes: size.barcodes
          .map((barcode) => normalizeBarcodeValue(barcode))
          .filter(Boolean),
        vendorCode: card.vendorCode,
        title: card.title,
        brand: card.brand,
      });
    }
  }

  return map;
}

export function buildBarcodeToChrtEntry(
  catalog: Map<number, WbChrtCatalogEntry>,
): Map<string, WbChrtCatalogEntry> {
  const map = new Map<string, WbChrtCatalogEntry>();

  for (const entry of catalog.values()) {
    for (const barcode of entry.barcodes) {
      if (!map.has(barcode)) {
        map.set(barcode, entry);
      }
    }
  }

  return map;
}

export function enrichRawRowsToWbStockItems(
  rawRows: WbRawStockRow[],
  catalog: Map<number, WbChrtCatalogEntry>,
): WbStockItem[] {
  return rawRows.map((row) => {
    const entry = row.chrtId !== null ? catalog.get(row.chrtId) : undefined;

    return {
      nmID: row.nmId,
      chrtId: row.chrtId,
      warehouseId: row.warehouseId,
      vendorCode: entry?.vendorCode ?? null,
      barcode: entry?.barcodes[0] ?? null,
      techSize: entry?.techSize ?? null,
      title: entry?.title ?? null,
      brand: entry?.brand ?? null,
      warehouseName: row.warehouseName,
      quantity: row.quantity,
      inWayToClient: row.inWayToClient,
      inWayFromClient: row.inWayFromClient,
      lastChangeDate: null,
      stockGranularity: "size" as const,
    };
  });
}

export function aggregateStockByChrtId(
  rawRows: WbRawStockRow[],
  catalog: Map<number, WbChrtCatalogEntry>,
): Map<number, WbChrtStockAggregate> {
  const map = new Map<number, WbChrtStockAggregate>();

  for (const row of rawRows) {
    if (row.chrtId === null) {
      continue;
    }

    const entry = catalog.get(row.chrtId);
    const existing = map.get(row.chrtId);

    const warehouseStock: WbChrtWarehouseStock = {
      warehouseId: row.warehouseId,
      warehouseName: row.warehouseName,
      quantity: row.quantity,
      inWayToClient: row.inWayToClient,
      inWayFromClient: row.inWayFromClient,
    };

    if (existing) {
      existing.quantity += row.quantity;
      existing.inWayToClient += row.inWayToClient;
      existing.inWayFromClient += row.inWayFromClient;
      existing.warehouses.push(warehouseStock);
      continue;
    }

    map.set(row.chrtId, {
      nmId: entry?.nmId ?? row.nmId,
      chrtId: row.chrtId,
      techSize: entry?.techSize ?? "",
      barcodes: entry?.barcodes ?? [],
      vendorCode: entry?.vendorCode ?? "",
      title: entry?.title ?? "",
      brand: entry?.brand ?? "",
      quantity: row.quantity,
      inWayToClient: row.inWayToClient,
      inWayFromClient: row.inWayFromClient,
      warehouses: [warehouseStock],
    });
  }

  return map;
}

export function aggregateNmIdTotals(
  rawRows: WbRawStockRow[],
): Map<number, { quantity: number; inWayToClient: number; inWayFromClient: number }> {
  const map = new Map<number, { quantity: number; inWayToClient: number; inWayFromClient: number }>();

  for (const row of rawRows) {
    const existing = map.get(row.nmId);
    if (existing) {
      existing.quantity += row.quantity;
      existing.inWayToClient += row.inWayToClient;
      existing.inWayFromClient += row.inWayFromClient;
      continue;
    }

    map.set(row.nmId, {
      quantity: row.quantity,
      inWayToClient: row.inWayToClient,
      inWayFromClient: row.inWayFromClient,
    });
  }

  return map;
}

export function computeRawTotalQuantity(rawRows: WbRawStockRow[]): number {
  return rawRows.reduce((sum, row) => sum + row.quantity, 0);
}

export function computeLegacyTotalQuantity(rawRows: WbRawStockRow[]): number {
  const aggregated = new Map<string, number>();

  for (const row of rawRows) {
    const key = `${row.nmId}:${row.warehouseName}`;
    aggregated.set(key, (aggregated.get(key) ?? 0) + row.quantity);
  }

  return [...aggregated.values()].reduce((sum, value) => sum + value, 0);
}

export function buildWbWithout1cEntries(
  stockByChrtId: Map<number, WbChrtStockAggregate>,
  barcodeToSkuBarcodes: Set<string>,
): WbWithout1cEntry[] {
  const entries: WbWithout1cEntry[] = [];

  for (const stock of stockByChrtId.values()) {
    const matchedWith1c = stock.barcodes.some((barcode) => barcodeToSkuBarcodes.has(barcode));
    if (matchedWith1c) {
      continue;
    }

    entries.push({
      chrtId: stock.chrtId,
      nmId: stock.nmId,
      techSize: stock.techSize,
      barcodes: stock.barcodes,
      vendorCode: stock.vendorCode,
      title: stock.title,
      quantity: stock.quantity,
      inWayToClient: stock.inWayToClient,
      inWayFromClient: stock.inWayFromClient,
    });
  }

  return entries.sort((left, right) => right.quantity - left.quantity);
}

export function countMatchedChrtIds(
  stockByChrtId: Map<number, WbChrtStockAggregate>,
  barcodeToSkuBarcodes: Set<string>,
): { matched: number; unmatched: number } {
  let matched = 0;
  let unmatched = 0;

  for (const stock of stockByChrtId.values()) {
    const hasMatch = stock.barcodes.some((barcode) => barcodeToSkuBarcodes.has(barcode));
    if (hasMatch) {
      matched += 1;
    } else {
      unmatched += 1;
    }
  }

  return { matched, unmatched };
}

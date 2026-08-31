import type { IntegrationError } from "@/lib/integrations/types";

export type WbSizeStockAuditExample = {
  barcode: string;
  article: string;
  color: string;
  size: string;
  nmId: number;
  chrtId: number;
  techSize: string;
  warehouseName: string;
  quantity: number;
};

export type WbSizeStockAuditSizeRow = {
  techSize: string;
  chrtId: number;
  barcodes: string[];
  matchedBarcode: string | null;
  article: string | null;
  color: string | null;
  size: string | null;
  totalQuantity: number;
  totalInWayToClient: number;
  totalInWayFromClient: number;
  warehouses: Array<{
    warehouseId: number | null;
    warehouseName: string;
    quantity: number;
    inWayToClient: number;
    inWayFromClient: number;
  }>;
};

export type WbSizeStockAuditNmIdCheck = {
  nmId: number;
  oldAggregatedQuantity: number;
  newChrtSumQuantity: number;
  matchesOldTotal: boolean;
  uniqueChrtIds: number;
  chrtQuantitiesDistinct: boolean;
  sizes: WbSizeStockAuditSizeRow[];
};

export type WbSizeStockAuditMetrics = {
  totalRows: number;
  uniqueNmIds: number;
  uniqueChrtIds: number;
  uniqueBarcodes: number;
  matchedWith1c: number;
  unmatchedWith1c: number;
  warehouses: number;
  totalQuantity: number;
  totalInWayToClient: number;
  totalInWayFromClient: number;
  rowsWithoutChrtId: number;
};

export type WbSizeStockAuditResult = {
  source: "wildberries-size-stock-audit";
  endpoint: string;
  fetchedAt: string;
  durationMs: number;
  status: "ok" | "partial" | "error" | "not_configured";
  message: string;
  metrics: WbSizeStockAuditMetrics;
  examples: WbSizeStockAuditExample[];
  nmId96468303: WbSizeStockAuditNmIdCheck;
  error?: IntegrationError;
  cardsError?: IntegrationError;
};

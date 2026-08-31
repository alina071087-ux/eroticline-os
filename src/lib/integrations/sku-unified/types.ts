import type { IntegrationError } from "@/lib/integrations/types";
import type { WbWithout1cEntry } from "@/lib/integrations/wb/chrt-stocks";

export type SkuUnifiedMarketplaceMatchStatus = "matched" | "no_marketplace_match";

export type SkuUnifiedMatchStatus =
  | "matched_all"
  | "matched_wb_only"
  | "matched_ozon_only"
  | "no_marketplace_match";

export type SkuUnifiedWbWarehouseStock = {
  warehouseId: number | null;
  warehouseName: string;
  quantity: number;
  inWayToClient: number;
  inWayFromClient: number;
};

export type SkuUnifiedRow = {
  barcode: string;
  article: string;
  productName: string;
  color: string;
  size: string;
  nomenclatureRaw: string;
  characteristicRaw: string;

  wbNmIds: number[];
  wbVendorCodes: string[];
  wbChrtId: number | null;
  wbTechSize: string | null;
  wbBarcode: string | null;
  wbQuantity: number;
  wbInWayToClient: number;
  wbInWayFromClient: number;
  wbNmIdTotalQuantity: number | null;
  wbWarehouses: SkuUnifiedWbWarehouseStock[];
  wbStockGranularity: "size" | null;
  wbMatchStatus: SkuUnifiedMarketplaceMatchStatus;

  ozonProductIds: number[];
  ozonOfferIds: string[];
  ozonPresent: number;
  ozonReserved: number;
  ozonAvailable: number;
  ozonMatchStatus: SkuUnifiedMarketplaceMatchStatus;

  matchStatus: SkuUnifiedMatchStatus;
  matchMethod: string | null;
  warnings: string[];
  updatedAt: string;
};

export type SkuUnifiedMetrics = {
  totalSku: number;
  skuWithWb: number;
  skuWithOzon: number;
  skuWithBoth: number;
  skuWithoutMarketplaces: number;
  wbNmIds: number;
  ozonProducts: number;
  unmatched: number;
  warningsCount: number;
  skuWithWbQuantityZero: number;
  skuWithWbQuantityPositive: number;
};

export type SkuUnifiedAudit = {
  withWb: number;
  withOzon: number;
  withBoth: number;
  wbOnly: number;
  ozonOnly: number;
  neither: number;
  totalChrtIds: number;
  matchedChrtIds: number;
  unmatchedChrtIds: number;
};

export type SkuUnifiedWbDiagnostics = {
  wbMatchedChrtIds: number;
  wbUnmatchedChrtIds: number;
  wbTotalQuantity: number;
  wbTotalInWayToClient: number;
  wbTotalInWayFromClient: number;
  legacyTotalQuantity: number;
  legacyTotalsMatch: boolean;
};

export type SkuUnifiedNmId96468303Check = {
  nmId: number;
  oldAggregatedQuantity: number;
  newChrtSumQuantity: number;
  matchesOldTotal: boolean;
  sizes: Array<{
    techSize: string;
    chrtId: number;
    barcode: string | null;
    quantity: number;
  }>;
};

export type SkuUnifiedResult = {
  source: "sku-unified";
  fetchedAt: string;
  durationMs: number;
  status: "ok" | "partial" | "error";
  message: string;
  metrics: SkuUnifiedMetrics;
  audit: SkuUnifiedAudit;
  wbDiagnostics: SkuUnifiedWbDiagnostics;
  wbWithout1c: WbWithout1cEntry[];
  nmId96468303: SkuUnifiedNmId96468303Check;
  items: SkuUnifiedRow[];
  error?: IntegrationError;
  wbError?: IntegrationError;
  ozonError?: IntegrationError;
};

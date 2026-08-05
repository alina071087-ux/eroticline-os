import type { IntegrationError } from "@/lib/integrations/types";

export type OzonIntegrationStatus = "ok" | "error" | "not_configured";

export type OzonProduct = {
  productId: number;
  offerId: string;
  name: string;
  barcode?: string;
  barcodes?: string[];
  sku?: number;
  status?: string;
  archived: boolean;
};

export type OzonProductsResult = {
  source: "ozon";
  status: OzonIntegrationStatus;
  configured: boolean;
  fetchedAt: string;
  httpStatus?: number;
  durationMs?: number;
  message?: string;
  error?: IntegrationError;
  totalProducts?: number;
  pagesLoaded?: number;
  isComplete?: boolean;
  products?: OzonProduct[];
};

export type OzonStockTypeTotals = {
  rows: number;
  present: number;
  reserved: number;
  available: number;
};

export type OzonStockItem = {
  productId: number;
  offerId: string;
  warehouseId?: number;
  warehouseName?: string;
  present: number;
  reserved: number;
  available: number;
  stockType: string;
};

export type OzonStockTotals = {
  present: number;
  reserved: number;
  available: number;
  totalsByType: Record<string, OzonStockTypeTotals>;
};

export type OzonStocksResult = {
  source: "ozon";
  status: OzonIntegrationStatus;
  configured: boolean;
  fetchedAt: string;
  httpStatus?: number;
  durationMs?: number;
  message?: string;
  error?: IntegrationError;
  totalStockRows?: number;
  totalUniqueProducts?: number;
  pagesLoaded?: number;
  isComplete?: boolean;
  stockTypes?: string[];
  totals?: OzonStockTotals;
  stocks?: OzonStockItem[];
};

export type OzonInventoryItem = {
  productId: number;
  offerId: string;
  name?: string;
  barcode?: string;
  barcodes?: string[];
  warehouseId?: number;
  warehouseName?: string;
  present: number;
  reserved: number;
  available: number;
  stockType: string;
  productStatus?: string;
  matched: boolean;
};

export type OzonInventoryResult = {
  source: "ozon";
  status: OzonIntegrationStatus;
  configured: boolean;
  fetchedAt: string;
  httpStatus?: number;
  durationMs?: number;
  message?: string;
  error?: IntegrationError;
  totalInventoryRows?: number;
  totalUniqueProducts?: number;
  matchedProductsCount?: number;
  unmatchedProductsCount?: number;
  pagesLoaded?: number;
  isComplete?: boolean;
  stockTypes?: string[];
  totals?: OzonStockTotals;
  partialErrors?: {
    products?: IntegrationError;
    stocks?: IntegrationError;
  };
  items?: OzonInventoryItem[];
};

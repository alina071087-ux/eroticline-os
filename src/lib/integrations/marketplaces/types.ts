import type { IntegrationError, IntegrationStatus } from "@/lib/integrations/types";

export type MarketplaceMatchMethod =
  | "barcode_exact"
  | "offer_exact"
  | "offer_normalized"
  | "ambiguous"
  | "wb_only"
  | "ozon_only"
  | "no_identifier";

export type MarketplaceMatchConfidence = "high" | "medium" | "low" | "none";

export type MarketplaceWbGranularity = "nmId";

export type MarketplaceUnifiedItem = {
  id: string;
  offerId: string;
  title: string;
  wbNmId: number | null;
  wbVendorCode: string | null;
  wbBarcodes: string[];
  wbQuantity: number;
  wbGranularity: MarketplaceWbGranularity | null;
  ozonProductId: number | null;
  ozonOfferId: string | null;
  ozonBarcodes: string[];
  ozonAvailable: number;
  totalApi: number;
  matchMethod: MarketplaceMatchMethod;
  matchConfidence: MarketplaceMatchConfidence;
  warnings: string[];
};

export type MarketplaceIdentifierAudit = {
  wbNmIdsWithStock: number;
  wbNmIdsWithBarcode: number;
  uniqueWbBarcodes: number;
  uniqueOzonBarcodes: number;
  barcodeIntersections: number;
  offerExactIntersections: number;
  offerNormalizedIntersections: number;
  matchExamples: Array<{
    method: MarketplaceMatchMethod;
    wbNmId: number | null;
    wbVendorCode: string | null;
    ozonProductId: number | null;
    ozonOfferId: string | null;
    sharedBarcodes: string[];
  }>;
  mismatchExamples: Array<{
    side: "wb" | "ozon";
    identifier: string;
    nmId?: number;
    productId?: number;
    offerId?: string;
    barcodes: string[];
    reason: string;
  }>;
};

export type MarketplaceMatchQualityMetrics = {
  barcodeExact: number;
  offerExact: number;
  offerNormalized: number;
  ambiguous: number;
  wbOnly: number;
  ozonOnly: number;
  noIdentifier: number;
  totalUnified: number;
};

export type MarketplaceSummaryMetrics = {
  wbQuantity: number;
  wbInWayToClient: number;
  wbInWayFromClient: number;
  ozonPresent: number;
  ozonReserved: number;
  ozonAvailable: number;
};

export type MarketplacePlatformStatus = {
  status: IntegrationStatus;
  configured: boolean;
  fetchedAt: string | null;
  isComplete: boolean;
  error?: IntegrationError;
};

export type MarketplaceInventoryResult = {
  source: "marketplaces";
  status: IntegrationStatus;
  configured: boolean;
  fetchedAt: string;
  durationMs?: number;
  message?: string;
  error?: IntegrationError;
  wb?: MarketplacePlatformStatus & {
    quantity: number;
    inWayToClient: number;
    inWayFromClient: number;
    productCount: number;
    warehouseCount: number;
  };
  ozon?: MarketplacePlatformStatus & {
    present: number;
    reserved: number;
    available: number;
    productCount: number;
    rowCount: number;
  };
  summary?: MarketplaceSummaryMetrics;
  matchQuality?: MarketplaceMatchQualityMetrics;
  identifierAudit?: MarketplaceIdentifierAudit;
  items?: MarketplaceUnifiedItem[];
  partialErrors?: {
    wbInventory?: IntegrationError;
    wbProducts?: IntegrationError;
    ozonInventory?: IntegrationError;
  };
};

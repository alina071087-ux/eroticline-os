import type { SkuUnifiedRow } from "@/lib/integrations/sku-unified/types";

export type SkuUnifiedPlatformFilter = "all" | "wb" | "ozon" | "both" | "none";

export type SkuUnifiedFilters = {
  article: string;
  barcode: string;
  color: string;
  size: string;
  platform: SkuUnifiedPlatformFilter;
  wbZeroStock: boolean;
  wbPositiveStock: boolean;
  ozonZeroStock: boolean;
};

export type SkuUnifiedPageMetrics = {
  totalSku: number;
  skuWithWb: number;
  skuWithOzon: number;
  skuWithBoth: number;
  skuWithoutMarketplaces: number;
  wbZeroStock: number;
  ozonZeroStock: number;
};

export type SkuUnifiedWarningLevel = "critical" | "warning" | "none";

export type SkuUnifiedTableRow = SkuUnifiedRow & {
  warningLevel: SkuUnifiedWarningLevel;
  warningLabel: string;
};

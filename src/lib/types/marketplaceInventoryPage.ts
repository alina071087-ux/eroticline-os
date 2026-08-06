import type {
  MarketplaceInventoryResult,
  MarketplaceMatchMethod,
  MarketplaceUnifiedItem,
} from "@/lib/integrations/marketplaces/types";

export type MarketplacePlatformFilter = "all" | "wb" | "ozon";

export type MarketplaceSortKey =
  | "offerId"
  | "wbQuantity"
  | "ozonAvailable"
  | "totalApi";

export type MarketplaceSortDirection = "asc" | "desc";

export type MarketplaceMatchMethodFilter = MarketplaceMatchMethod | "all" | "cross_platform";

export type MarketplaceInventoryFilters = {
  search: string;
  platform: MarketplacePlatformFilter;
  matchMethod: MarketplaceMatchMethodFilter;
  onlyWithStock: boolean;
  onlySinglePlatform: boolean;
  onlyWithoutIdentifier: boolean;
  onlyAmbiguous: boolean;
};

export type {
  MarketplaceInventoryResult,
  MarketplaceMatchMethod,
  MarketplaceUnifiedItem,
};

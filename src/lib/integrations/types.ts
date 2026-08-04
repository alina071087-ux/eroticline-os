export type IntegrationStatus = "ok" | "error" | "not_configured";

export type IntegrationErrorCode =
  | "MISSING_TOKEN"
  | "INVALID_TOKEN"
  | "FORBIDDEN"
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "EMPTY_RESPONSE"
  | "API_ERROR";

export type IntegrationError = {
  code: IntegrationErrorCode;
  message: string;
};

export type IntegrationTestResult = {
  source: string;
  status: IntegrationStatus;
  configured: boolean;
  checkedAt: string;
  httpStatus?: number;
  durationMs?: number;
  message?: string;
  error?: IntegrationError;
  data?: Record<string, unknown>;
};

export type WbProductSize = {
  chrtID: number;
  techSize: string;
  barcodes: string[];
};

export type WbProductCard = {
  nmID: number;
  vendorCode: string;
  title: string;
  brand: string;
  subjectName: string;
  sizes: WbProductSize[];
};

export type WbProductsResult = {
  source: string;
  status: IntegrationStatus;
  configured: boolean;
  fetchedAt: string;
  httpStatus?: number;
  durationMs?: number;
  count?: number;
  message?: string;
  error?: IntegrationError;
  products?: WbProductCard[];
};

export type WbStockItem = {
  nmID: number;
  vendorCode: string | null;
  barcode: string | null;
  techSize: string | null;
  warehouseName: string;
  quantity: number;
  inWayToClient: number;
  inWayFromClient: number;
  lastChangeDate: string | null;
};

export type WbStocksResult = {
  source: string;
  status: IntegrationStatus;
  configured: boolean;
  fetchedAt: string;
  httpStatus?: number;
  durationMs?: number;
  count?: number;
  message?: string;
  error?: IntegrationError;
  missingFields?: string[];
  stocks?: WbStockItem[];
  totalStockRows?: number;
  totalUniqueNmIds?: number;
  pagesLoaded?: number;
  isComplete?: boolean;
};

export type WbProductSource = "active" | "trash" | "unknown";

export type WbInventoryItem = {
  nmID: number;
  vendorCode: string | null;
  title: string | null;
  brand: string | null;
  techSize: string | null;
  barcode: string | null;
  warehouseName: string;
  quantity: number;
  inWayToClient: number;
  inWayFromClient: number;
  stockLevel: "nmID";
  productSource: WbProductSource;
};

export type WbInventoryResult = {
  source: string;
  status: IntegrationStatus;
  configured: boolean;
  fetchedAt: string;
  httpStatus?: number;
  durationMs?: number;
  count?: number;
  message?: string;
  error?: IntegrationError;
  quantityScope: string;
  stockNmIdsCount?: number;
  matchedNmIdsCount?: number;
  unmatchedNmIdsCount?: number;
  productsScanned?: number;
  activeProductsScanned?: number;
  trashProductsScanned?: number;
  matchedFromActiveCount?: number;
  matchedFromTrashCount?: number;
  unmatchedNmIds?: number[];
  partialErrors?: {
    products?: IntegrationError;
    stocks?: IntegrationError;
  };
  totalStockRows?: number;
  totalUniqueNmIds?: number;
  pagesLoaded?: number;
  isComplete?: boolean;
  items?: WbInventoryItem[];
};

import type {
  MarketplaceInventoryFilters,
  MarketplaceMatchMethod,
  MarketplaceSortDirection,
  MarketplaceSortKey,
  MarketplaceUnifiedItem,
} from "@/lib/types/marketplaceInventoryPage";

export function formatInventoryNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value);
}

export function formatFetchedAt(isoDate: string): string {
  return new Date(isoDate).toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const MATCH_METHOD_LABELS: Record<MarketplaceMatchMethod, string> = {
  barcode_exact: "По штрихкоду",
  offer_exact: "По артикулу",
  offer_normalized: "По нормализованному артикулу",
  ambiguous: "Неоднозначно",
  wb_only: "Только WB",
  ozon_only: "Только Ozon",
  no_identifier: "Без идентификатора",
};

export function getMatchMethodLabel(method: MarketplaceMatchMethod): string {
  return MATCH_METHOD_LABELS[method];
}

export function isCrossPlatformMatch(method: MarketplaceMatchMethod): boolean {
  return (
    method === "barcode_exact" ||
    method === "offer_exact" ||
    method === "offer_normalized"
  );
}

export function getMatchMethodStyles(method: MarketplaceMatchMethod): string {
  switch (method) {
    case "barcode_exact":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
    case "offer_exact":
      return "border-teal-500/20 bg-teal-500/10 text-teal-300";
    case "offer_normalized":
      return "border-cyan-500/20 bg-cyan-500/10 text-cyan-300";
    case "ambiguous":
      return "border-red-500/20 bg-red-500/10 text-red-300";
    case "wb_only":
      return "border-violet-500/20 bg-violet-500/10 text-violet-300";
    case "ozon_only":
      return "border-blue-500/20 bg-blue-500/10 text-blue-300";
    case "no_identifier":
    default:
      return "border-amber-500/20 bg-amber-500/10 text-amber-300";
  }
}

export function filterUnifiedProducts(
  products: MarketplaceUnifiedItem[],
  filters: MarketplaceInventoryFilters,
): MarketplaceUnifiedItem[] {
  const search = filters.search.trim().toLowerCase();

  return products.filter((product) => {
    if (filters.onlyWithStock && product.totalApi <= 0) {
      return false;
    }

    if (filters.matchMethod === "cross_platform") {
      if (!isCrossPlatformMatch(product.matchMethod)) {
        return false;
      }
    } else if (
      filters.matchMethod !== "all" &&
      product.matchMethod !== filters.matchMethod
    ) {
      return false;
    }

    if (filters.onlySinglePlatform && isCrossPlatformMatch(product.matchMethod)) {
      return false;
    }

    if (filters.onlyWithoutIdentifier && product.matchMethod !== "no_identifier") {
      return false;
    }

    if (filters.onlyAmbiguous && product.matchMethod !== "ambiguous") {
      return false;
    }

    if (filters.platform === "wb" && product.wbQuantity <= 0) {
      return false;
    }

    if (filters.platform === "ozon" && product.ozonAvailable <= 0) {
      return false;
    }

    if (!search) {
      return true;
    }

    const offerId = product.offerId.toLowerCase();
    const title = product.title.toLowerCase();
    const barcodeMatches = [...product.wbBarcodes, ...product.ozonBarcodes].some(
      (barcode) => barcode.toLowerCase().includes(search),
    );

    return (
      offerId.includes(search) ||
      title.includes(search) ||
      barcodeMatches ||
      String(product.wbNmId ?? "").includes(search) ||
      String(product.ozonProductId ?? "").includes(search)
    );
  });
}

function compareValues(
  left: string | number,
  right: string | number,
  direction: MarketplaceSortDirection,
): number {
  if (typeof left === "number" && typeof right === "number") {
    return direction === "asc" ? left - right : right - left;
  }

  const leftValue = String(left).toLowerCase();
  const rightValue = String(right).toLowerCase();

  if (leftValue === rightValue) {
    return 0;
  }

  return direction === "asc"
    ? leftValue < rightValue
      ? -1
      : 1
    : leftValue > rightValue
      ? -1
      : 1;
}

export function sortUnifiedProducts(
  products: MarketplaceUnifiedItem[],
  sortKey: MarketplaceSortKey,
  direction: MarketplaceSortDirection,
): MarketplaceUnifiedItem[] {
  const sorted = [...products];

  sorted.sort((left, right) => {
    switch (sortKey) {
      case "offerId":
        return compareValues(left.offerId, right.offerId, direction);
      case "wbQuantity":
        return compareValues(left.wbQuantity, right.wbQuantity, direction);
      case "ozonAvailable":
        return compareValues(left.ozonAvailable, right.ozonAvailable, direction);
      case "totalApi":
      default:
        return compareValues(left.totalApi, right.totalApi, direction);
    }
  });

  return sorted;
}

export function getSafeErrorMessage(message?: string): string {
  return (
    message ??
    "Не удалось загрузить объединённые остатки маркетплейсов."
  );
}

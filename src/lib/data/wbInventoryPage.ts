import type {
  WbInventoryFilters,
  WbInventoryGrouping,
  WbInventoryItem,
  WbInventoryPageMetrics,
  WbInventoryResult,
  WbInventorySortDirection,
  WbInventorySortKey,
  WbInventoryTableRow,
  WbProductSource,
} from "@/lib/types/wbInventoryPage";

const SOURCE_LABELS: Record<WbProductSource, string> = {
  active: "Активная",
  trash: "Корзина WB",
  unknown: "Не сопоставлена",
};

export function getProductSourceLabel(source: WbProductSource): string {
  return SOURCE_LABELS[source];
}

export function getDisplayTitle(item: WbInventoryItem): string {
  if (item.title?.trim()) {
    return item.title.trim();
  }

  return "Карточка в корзине WB";
}

export function buildInventoryMetrics(
  displayItems: WbInventoryItem[],
  result: Pick<
    WbInventoryResult,
    "matchedNmIdsCount" | "stockNmIdsCount" | "uniqueChrtIds" | "totalQuantity"
  >,
  rawItems: WbInventoryItem[] = displayItems,
): WbInventoryPageMetrics {
  const uniqueNmIds = new Set(displayItems.map((item) => item.nmID));
  const uniqueChrtIds = new Set(
    displayItems
      .map((item) => item.chrtId)
      .filter((value): value is number => value !== null),
  );
  const uniqueWarehouses = new Set(
    rawItems
      .map((item) => item.warehouseName)
      .filter((warehouse) => warehouse !== "Все склады"),
  );

  const aggregatedTotal = displayItems.reduce((sum, item) => sum + item.quantity, 0);

  return {
    totalQuantity: aggregatedTotal,
    totalInWayToClient: displayItems.reduce(
      (sum, item) => sum + item.inWayToClient,
      0,
    ),
    totalInWayFromClient: displayItems.reduce(
      (sum, item) => sum + item.inWayFromClient,
      0,
    ),
    uniqueNmIds: uniqueNmIds.size,
    uniqueChrtIds: result.uniqueChrtIds ?? uniqueChrtIds.size,
    uniqueWarehouses: uniqueWarehouses.size,
    matchedNmIdsCount: result.matchedNmIdsCount ?? 0,
    stockNmIdsCount: result.stockNmIdsCount ?? 0,
    serverTotalQuantity: result.totalQuantity ?? aggregatedTotal,
    totalsMatch:
      result.totalQuantity === undefined
        ? true
        : result.totalQuantity === aggregatedTotal,
  };
}

function matchesSearch(item: WbInventoryItem, search: string): boolean {
  if (!search) {
    return true;
  }

  const title = getDisplayTitle(item).toLowerCase();
  const vendorCode = item.vendorCode?.toLowerCase() ?? "";
  const nmId = String(item.nmID);
  const techSize = item.techSize?.toLowerCase() ?? "";
  const barcode = item.barcode?.toLowerCase() ?? "";
  const chrtId = item.chrtId !== null ? String(item.chrtId) : "";

  return (
    title.includes(search) ||
    vendorCode.includes(search) ||
    nmId.includes(search) ||
    techSize.includes(search) ||
    barcode.includes(search) ||
    chrtId.includes(search)
  );
}

export function aggregateInventoryByChrtId(
  items: WbInventoryItem[],
): WbInventoryItem[] {
  const grouped = new Map<number, WbInventoryItem>();

  for (const item of items) {
    if (item.chrtId === null) {
      continue;
    }

    const existing = grouped.get(item.chrtId);

    if (!existing) {
      grouped.set(item.chrtId, {
        ...item,
        warehouseId: null,
        warehouseName: "Все склады",
      });
      continue;
    }

    grouped.set(item.chrtId, {
      ...existing,
      quantity: existing.quantity + item.quantity,
      inWayToClient: existing.inWayToClient + item.inWayToClient,
      inWayFromClient: existing.inWayFromClient + item.inWayFromClient,
    });
  }

  return [...grouped.values()];
}

export function prepareInventoryDisplayItems(
  items: WbInventoryItem[],
  filters: WbInventoryFilters,
): WbInventoryItem[] {
  const search = filters.search.trim().toLowerCase();

  const preFiltered = items.filter((item) => {
    if (filters.warehouse !== "all" && item.warehouseName !== filters.warehouse) {
      return false;
    }

    if (filters.source !== "all" && item.productSource !== filters.source) {
      return false;
    }

    return matchesSearch(item, search);
  });

  const display =
    filters.warehouse === "all"
      ? aggregateInventoryByChrtId(preFiltered)
      : preFiltered;

  if (!filters.onlyWithStock) {
    return display;
  }

  return display.filter((item) => item.quantity > 0);
}

/** @deprecated Use prepareInventoryDisplayItems */
export function groupInventoryItems(
  items: WbInventoryItem[],
  grouping: WbInventoryGrouping,
  filters?: WbInventoryFilters,
): WbInventoryItem[] {
  if (filters) {
    return prepareInventoryDisplayItems(items, filters);
  }

  if (grouping === "warehouse") {
    return items;
  }

  return aggregateInventoryByChrtId(items);
}

function compareValues(
  left: string | number,
  right: string | number,
  direction: WbInventorySortDirection,
): number {
  if (typeof left === "number" && typeof right === "number") {
    return direction === "asc" ? left - right : right - left;
  }

  const leftValue = String(left).toLowerCase();
  const rightValue = String(right).toLowerCase();

  if (leftValue === rightValue) {
    return 0;
  }

  if (direction === "asc") {
    return leftValue < rightValue ? -1 : 1;
  }

  return leftValue > rightValue ? -1 : 1;
}

export function sortInventoryItems(
  items: WbInventoryItem[],
  sortKey: WbInventorySortKey,
  direction: WbInventorySortDirection,
): WbInventoryItem[] {
  const sorted = [...items];

  sorted.sort((left, right) => {
    switch (sortKey) {
      case "vendorCode":
        return compareValues(
          left.vendorCode ?? "",
          right.vendorCode ?? "",
          direction,
        );
      case "warehouseName":
        return compareValues(
          left.warehouseName,
          right.warehouseName,
          direction,
        );
      case "techSize":
        return compareValues(
          left.techSize ?? "",
          right.techSize ?? "",
          direction,
        );
      case "quantity":
      default:
        return compareValues(left.quantity, right.quantity, direction);
    }
  });

  return sorted;
}

export function toTableRows(items: WbInventoryItem[]): WbInventoryTableRow[] {
  return items.map((item) => ({
    id:
      item.warehouseName === "Все склады"
        ? `size-${item.chrtId ?? item.nmID}`
        : `warehouse-${item.nmID}-${item.chrtId ?? "none"}-${item.warehouseName}`,
    nmID: item.nmID,
    chrtId: item.chrtId,
    techSize: item.techSize,
    barcode: item.barcode,
    vendorCode: item.vendorCode,
    displayTitle: getDisplayTitle(item),
    warehouseName: item.warehouseName,
    quantity: item.quantity,
    inWayToClient: item.inWayToClient,
    inWayFromClient: item.inWayFromClient,
    productSource: item.productSource,
    productSourceLabel: getProductSourceLabel(item.productSource),
  }));
}

export function getWarehouseOptions(items: WbInventoryItem[]): string[] {
  return [...new Set(items.map((item) => item.warehouseName))]
    .filter((warehouse) => warehouse !== "Все склады")
    .sort((left, right) => left.localeCompare(right, "ru"));
}

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

export function getSafeErrorMessage(result: WbInventoryResult): string {
  if (result.status === "not_configured") {
    return "Токен Wildberries не настроен. Добавьте WB_API_TOKEN в .env.local и перезапустите сервер.";
  }

  return (
    result.error?.message ??
    result.message ??
    "Не удалось загрузить остатки Wildberries."
  );
}

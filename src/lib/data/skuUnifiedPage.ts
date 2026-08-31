import type { SkuUnifiedMatchStatus, SkuUnifiedRow } from "@/lib/integrations/sku-unified/types";
import type {
  SkuUnifiedFilters,
  SkuUnifiedPageMetrics,
  SkuUnifiedTableRow,
  SkuUnifiedWarningLevel,
} from "@/lib/types/skuUnifiedPage";

export function formatInventoryNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value);
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const MATCH_STATUS_LABELS: Record<SkuUnifiedMatchStatus, string> = {
  matched_all: "WB + Ozon",
  matched_wb_only: "Только WB",
  matched_ozon_only: "Только Ozon",
  no_marketplace_match: "Нет площадок",
};

export function getMatchStatusLabel(status: SkuUnifiedMatchStatus): string {
  return MATCH_STATUS_LABELS[status];
}

export function getMatchStatusStyles(status: SkuUnifiedMatchStatus): string {
  switch (status) {
    case "matched_all":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
    case "matched_wb_only":
      return "border-violet-500/20 bg-violet-500/10 text-violet-300";
    case "matched_ozon_only":
      return "border-blue-500/20 bg-blue-500/10 text-blue-300";
    case "no_marketplace_match":
    default:
      return "border-red-500/20 bg-red-500/10 text-red-300";
  }
}

export function getVisibleWarnings(row: SkuUnifiedRow): string[] {
  return row.warnings.filter(
    (warning) => !warning.startsWith("Остаток Wildberries доступен на уровне nmID"),
  );
}

export function isWbZeroStock(row: SkuUnifiedRow): boolean {
  return (
    row.wbMatchStatus === "matched" &&
    row.wbQuantity === 0 &&
    row.wbInWayToClient === 0 &&
    row.wbInWayFromClient === 0
  );
}

export function isOzonZeroStock(row: SkuUnifiedRow): boolean {
  return (
    row.ozonMatchStatus === "matched" &&
    row.ozonPresent === 0 &&
    row.ozonReserved === 0 &&
    row.ozonAvailable === 0
  );
}

export function getSkuUnifiedWarningLevel(row: SkuUnifiedRow): SkuUnifiedWarningLevel {
  if (row.matchStatus === "no_marketplace_match") {
    return "critical";
  }

  if (isWbZeroStock(row) || isOzonZeroStock(row)) {
    return "warning";
  }

  const visibleWarnings = getVisibleWarnings(row);
  if (visibleWarnings.some((warning) => warning.includes("не найден"))) {
    return "critical";
  }

  return "none";
}

export function getSkuUnifiedWarningLabel(row: SkuUnifiedRow): string {
  const level = getSkuUnifiedWarningLevel(row);

  if (level === "critical") {
    const visible = getVisibleWarnings(row);
    if (visible.length > 0) {
      return visible[0];
    }
    return "SKU отсутствует на WB и Ozon";
  }

  if (level === "warning") {
    const parts: string[] = [];
    if (isWbZeroStock(row)) {
      parts.push("Нулевой остаток WB");
    }
    if (isOzonZeroStock(row)) {
      parts.push("Нулевой остаток Ozon");
    }
    return parts.join("; ");
  }

  return "—";
}

export function getWarningLevelStyles(level: SkuUnifiedWarningLevel): string {
  switch (level) {
    case "critical":
      return "border-red-500/20 bg-red-500/10 text-red-300";
    case "warning":
      return "border-amber-500/20 bg-amber-500/10 text-amber-300";
    case "none":
    default:
      return "border-zinc-500/20 bg-zinc-500/10 text-zinc-400";
  }
}

export function enrichSkuUnifiedRow(row: SkuUnifiedRow): SkuUnifiedTableRow {
  return {
    ...row,
    warningLevel: getSkuUnifiedWarningLevel(row),
    warningLabel: getSkuUnifiedWarningLabel(row),
  };
}

export function computePageMetrics(items: SkuUnifiedRow[]): SkuUnifiedPageMetrics {
  let skuWithWb = 0;
  let skuWithOzon = 0;
  let skuWithBoth = 0;
  let skuWithoutMarketplaces = 0;
  let wbZeroStock = 0;
  let ozonZeroStock = 0;

  for (const item of items) {
    const hasWb = item.wbMatchStatus === "matched";
    const hasOzon = item.ozonMatchStatus === "matched";

    if (hasWb) {
      skuWithWb += 1;
    }
    if (hasOzon) {
      skuWithOzon += 1;
    }
    if (hasWb && hasOzon) {
      skuWithBoth += 1;
    }
    if (!hasWb && !hasOzon) {
      skuWithoutMarketplaces += 1;
    }
    if (isWbZeroStock(item)) {
      wbZeroStock += 1;
    }
    if (isOzonZeroStock(item)) {
      ozonZeroStock += 1;
    }
  }

  return {
    totalSku: items.length,
    skuWithWb,
    skuWithOzon,
    skuWithBoth,
    skuWithoutMarketplaces,
    wbZeroStock,
    ozonZeroStock,
  };
}

function matchesPlatform(row: SkuUnifiedRow, platform: SkuUnifiedFilters["platform"]): boolean {
  const hasWb = row.wbMatchStatus === "matched";
  const hasOzon = row.ozonMatchStatus === "matched";

  switch (platform) {
    case "wb":
      return hasWb;
    case "ozon":
      return hasOzon;
    case "both":
      return hasWb && hasOzon;
    case "none":
      return !hasWb && !hasOzon;
    case "all":
    default:
      return true;
  }
}

export function filterSkuUnifiedRows(
  rows: SkuUnifiedRow[],
  filters: SkuUnifiedFilters,
): SkuUnifiedRow[] {
  const article = filters.article.trim().toLowerCase();
  const barcode = filters.barcode.trim().toLowerCase();
  const color = filters.color.trim().toLowerCase();
  const size = filters.size.trim().toLowerCase();

  return rows.filter((row) => {
    if (!matchesPlatform(row, filters.platform)) {
      return false;
    }

    if (filters.wbZeroStock && !isWbZeroStock(row)) {
      return false;
    }

    if (filters.wbPositiveStock && !(row.wbMatchStatus === "matched" && row.wbQuantity > 0)) {
      return false;
    }

    if (filters.ozonZeroStock && !isOzonZeroStock(row)) {
      return false;
    }

    if (article && !row.article.toLowerCase().includes(article)) {
      return false;
    }

    if (barcode && !row.barcode.toLowerCase().includes(barcode)) {
      return false;
    }

    if (color && !row.color.toLowerCase().includes(color)) {
      return false;
    }

    if (size && !row.size.toLowerCase().includes(size)) {
      return false;
    }

    return true;
  });
}

export function formatIdList(values: Array<number | string>): string {
  if (values.length === 0) {
    return "—";
  }

  return values.join(", ");
}

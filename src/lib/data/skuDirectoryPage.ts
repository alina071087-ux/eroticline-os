import type {
  OneCMatchStatus,
  OneCReconciliationRow,
} from "@/lib/integrations/1c/types";
import type { SkuDirectoryFilters } from "@/lib/types/skuDirectoryPage";

export function formatInventoryNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value);
}

export function formatPercent(value: number): string {
  return `${new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

const MATCH_STATUS_LABELS: Record<OneCMatchStatus, string> = {
  matched_all: "WB + Ozon",
  matched_wb_only: "Только WB",
  matched_ozon_only: "Только Ozon",
  unmatched: "Не найдено",
  duplicate_barcode: "Дубль штрихкода",
  ambiguous: "Неоднозначно",
  invalid: "Невалидная строка",
};

export function getMatchStatusLabel(status: OneCMatchStatus): string {
  return MATCH_STATUS_LABELS[status];
}

export function getMatchStatusStyles(status: OneCMatchStatus): string {
  switch (status) {
    case "matched_all":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
    case "matched_wb_only":
      return "border-violet-500/20 bg-violet-500/10 text-violet-300";
    case "matched_ozon_only":
      return "border-blue-500/20 bg-blue-500/10 text-blue-300";
    case "unmatched":
      return "border-zinc-500/20 bg-zinc-500/10 text-zinc-300";
    case "duplicate_barcode":
      return "border-amber-500/20 bg-amber-500/10 text-amber-300";
    case "ambiguous":
      return "border-red-500/20 bg-red-500/10 text-red-300";
    case "invalid":
    default:
      return "border-orange-500/20 bg-orange-500/10 text-orange-300";
  }
}

function escapeCsvValue(value: string): string {
  let safe = value.replace(/\r?\n/g, " ").trim();

  if (/^[=+\-@]/.test(safe)) {
    safe = `'${safe}`;
  }

  if (/[",;]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }

  return safe;
}

export function filterReconciliationRows(
  rows: OneCReconciliationRow[],
  filters: SkuDirectoryFilters,
): OneCReconciliationRow[] {
  const search = filters.search.trim().toLowerCase();

  return rows.filter((row) => {
    if (filters.onlyWithErrors) {
      const hasErrors =
        row.parseWarnings.length > 0 ||
        row.warnings.some(
          (warning) =>
            !warning.includes("Wildberries передаёт остатки на уровне nmID"),
        );
      if (!hasErrors) {
        return false;
      }
    }

    if (filters.onlyUnmatched && row.matchStatus !== "unmatched") {
      return false;
    }

    if (filters.onlyMatchedBoth && row.matchStatus !== "matched_all") {
      return false;
    }

    if (filters.matchStatus === "matched_both") {
      if (row.matchStatus !== "matched_all") {
        return false;
      }
    } else if (
      filters.matchStatus !== "all" &&
      row.matchStatus !== filters.matchStatus
    ) {
      return false;
    }

    if (!search) {
      return true;
    }

    const haystack = [
      row.nomenclatureRaw,
      row.characteristicRaw,
      row.barcode,
      row.article,
      row.productName,
      row.color,
      row.size,
      row.wbVendorCode ?? "",
      String(row.wbNmId ?? ""),
      String(row.ozonProductId ?? ""),
      row.ozonOfferId ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(search);
  });
}

export function buildSkuAuditCsv(rows: OneCReconciliationRow[]): string {
  const headers = [
    "Номенклатура 1С",
    "Характеристика",
    "Штрихкод",
    "Артикул",
    "Название",
    "Цвет",
    "Размер",
    "WB nmID",
    "WB артикул",
    "Ozon productId",
    "Ozon offerId",
    "Статус",
    "Предупреждение",
  ];

  const lines = [
    headers.join(";"),
    ...rows.map((row) =>
      [
        row.nomenclatureRaw,
        row.characteristicRaw,
        row.barcode,
        row.article,
        row.productName,
        row.color,
        row.size,
        row.wbNmId ?? "",
        row.wbVendorCode ?? "",
        row.ozonProductId ?? "",
        row.ozonOfferId ?? "",
        getMatchStatusLabel(row.matchStatus),
        [...row.parseWarnings, ...row.warnings].join(" | "),
      ]
        .map((value) => escapeCsvValue(String(value)))
        .join(";"),
    ),
  ];

  return `\uFEFF${lines.join("\r\n")}`;
}

export function downloadSkuAuditCsv(rows: OneCReconciliationRow[], fileName: string) {
  const csv = buildSkuAuditCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function getSafeErrorMessage(message?: string): string {
  return message ?? "Не удалось выполнить проверку файла 1С.";
}

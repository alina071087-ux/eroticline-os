import type { FinanceMetricUnit } from "@/lib/types/finance";

const rubFormatter = new Intl.NumberFormat("ru-RU");

export function formatMetricValue(value: number, unit: FinanceMetricUnit): string {
  const formatted = rubFormatter.format(value);

  if (unit === "pcs") {
    return `${formatted} шт`;
  }

  return `${formatted} ₽`;
}

export function formatUpdatedAt(isoDate: string): string {
  return new Date(isoDate).toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

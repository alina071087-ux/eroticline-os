import type { FinanceSheetData } from "@/lib/types/finance";

/**
 * Mock-данные, повторяющие структуру листа Google Sheets.
 * Колонки листа: key | label | value | unit
 *
 * Таблица: https://docs.google.com/spreadsheets/d/1jodwfzvPQr82-Lph-KIggLV2tG45tIhxxZ7hWfjUoe8
 * GID: 1333090276
 */
export const mockFinanceSheetData: FinanceSheetData = {
  source: "mock",
  spreadsheetId: "1jodwfzvPQr82-Lph-KIggLV2tG45tIhxxZ7hWfjUoe8",
  sheetGid: "1333090276",
  updatedAt: "2026-07-10T00:15:00+03:00",
  metrics: [
    {
      key: "total_money",
      label: "Деньги",
      value: 2_850_000,
      unit: "rub",
    },
    {
      key: "free_money",
      label: "Свободные деньги",
      value: 1_140_000,
      unit: "rub",
    },
    {
      key: "sales_today",
      label: "Продажи сегодня",
      value: 348_000,
      unit: "rub",
    },
    {
      key: "sales_month",
      label: "Продажи месяца",
      value: 18_420_000,
      unit: "rub",
    },
    {
      key: "profit",
      label: "Прибыль",
      value: 2_130_000,
      unit: "rub",
    },
    {
      key: "inventory",
      label: "Остатки",
      value: 6_248,
      unit: "pcs",
    },
    {
      key: "accounts_receivable",
      label: "Дебиторская задолженность",
      value: 1_980_000,
      unit: "rub",
    },
    {
      key: "accounts_payable",
      label: "Кредиторская задолженность",
      value: 4_820_000,
      unit: "rub",
    },
  ],
  aiCfo: {
    cashRunwayDays: 27,
    nextFactoryPaymentDays: 8,
  },
};

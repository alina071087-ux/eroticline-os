export type FinanceMetricKey =
  | "total_money"
  | "free_money"
  | "sales_today"
  | "sales_month"
  | "profit"
  | "inventory"
  | "accounts_receivable"
  | "accounts_payable";

export type FinanceMetricUnit = "rub" | "pcs";

/** Строка метрики — формат, ожидаемый от листа Google Sheets */
export type FinanceSheetRow = {
  key: FinanceMetricKey;
  label: string;
  value: number;
  unit: FinanceMetricUnit;
};

/** Блок AI CFO — отдельная секция на листе */
export type AiCfoSheetData = {
  cashRunwayDays: number;
  nextFactoryPaymentDays: number;
};

export type FinanceDataSource = "mock" | "google_sheets";

/** Нормализованные данные после загрузки из Google Sheets */
export type FinanceSheetData = {
  source: FinanceDataSource;
  spreadsheetId: string;
  sheetGid: string;
  updatedAt: string;
  metrics: FinanceSheetRow[];
  aiCfo: AiCfoSheetData;
};

/** View-model для UI Dashboard */
export type DashboardMetric = {
  key: FinanceMetricKey;
  title: string;
  value: string;
};

export type DashboardViewModel = {
  source: FinanceDataSource;
  updatedAt: string;
  metrics: DashboardMetric[];
  aiCfo: {
    cashRunwayDays: number;
    nextFactoryPaymentDays: number;
  };
};

/** Сырой формат строки CSV/API — для будущего парсера */
export type RawSheetRow = [string, string, string, string];

export const FINANCE_METRIC_KEYS: FinanceMetricKey[] = [
  "total_money",
  "free_money",
  "sales_today",
  "sales_month",
  "profit",
  "inventory",
  "accounts_receivable",
  "accounts_payable",
];

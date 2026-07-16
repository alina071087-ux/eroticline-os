import { mockFinanceSheetData } from "@/lib/data/mockFinanceData";
import { formatMetricValue, formatUpdatedAt } from "@/lib/data/formatters";
import type {
  DashboardViewModel,
  FinanceMetricKey,
  FinanceSheetData,
  RawSheetRow,
} from "@/lib/types/finance";
import { FINANCE_METRIC_KEYS } from "@/lib/types/finance";

export const GOOGLE_SHEETS_CONFIG = {
  spreadsheetId: "1jodwfzvPQr82-Lph-KIggLV2tG45tIhxxZ7hWfjUoe8",
  sheetGid: "1333090276",
  spreadsheetUrl:
    "https://docs.google.com/spreadsheets/d/1jodwfzvPQr82-Lph-KIggLV2tG45tIhxxZ7hWfjUoe8/edit?gid=1333090276",
  /** Диапазон листа Dashboard (будет использоваться при подключении API) */
  dashboardRange: "Dashboard!A2:D20",
  aiCfoRange: "Dashboard!F2:G5",
} as const;

function isFinanceMetricKey(value: string): value is FinanceMetricKey {
  return FINANCE_METRIC_KEYS.includes(value as FinanceMetricKey);
}

/**
 * Парсер сырых строк Google Sheets → нормализованная модель.
 * Ожидаемый формат строки: [key, label, value, unit]
 */
export function parseFinanceSheetRows(
  rows: RawSheetRow[],
  meta: Pick<FinanceSheetData, "spreadsheetId" | "sheetGid" | "updatedAt">,
): FinanceSheetData {
  const metrics = rows
    .filter(([key]) => isFinanceMetricKey(key))
    .map(([key, label, value, unit]) => ({
      key,
      label,
      value: Number(value.replace(/\s/g, "").replace(",", ".")),
      unit: unit === "pcs" ? "pcs" : "rub",
    })) as FinanceSheetData["metrics"];

  return {
    source: "google_sheets",
    spreadsheetId: meta.spreadsheetId,
    sheetGid: meta.sheetGid,
    updatedAt: meta.updatedAt,
    metrics,
    aiCfo: mockFinanceSheetData.aiCfo,
  };
}

/**
 * Загрузка данных из Google Sheets API.
 * Пока не реализовано — будет использовать service account / API key.
 */
async function fetchFromGoogleSheetsApi(): Promise<FinanceSheetData> {
  // TODO: подключить Google Sheets API v4
  // const sheets = google.sheets({ version: 'v4', auth });
  // const response = await sheets.spreadsheets.values.get({
  //   spreadsheetId: GOOGLE_SHEETS_CONFIG.spreadsheetId,
  //   range: GOOGLE_SHEETS_CONFIG.dashboardRange,
  // });
  // return parseFinanceSheetRows(response.data.values as RawSheetRow[], { ... });

  throw new Error(
    "Google Sheets API не настроен. Установите GOOGLE_SHEETS_USE_MOCK=false и добавьте credentials.",
  );
}

/**
 * Единая точка загрузки финансовых данных.
 * Сейчас возвращает mock; позже — реальные данные из Google Sheets.
 */
export async function fetchFinanceSheetData(): Promise<FinanceSheetData> {
  const useMock = process.env.GOOGLE_SHEETS_USE_MOCK !== "false";

  if (useMock) {
    return mockFinanceSheetData;
  }

  return fetchFromGoogleSheetsApi();
}

export function toDashboardViewModel(data: FinanceSheetData): DashboardViewModel {
  return {
    source: data.source,
    updatedAt: formatUpdatedAt(data.updatedAt),
    metrics: data.metrics.map((metric) => ({
      key: metric.key,
      title: metric.label,
      value: formatMetricValue(metric.value, metric.unit),
    })),
    aiCfo: data.aiCfo,
  };
}

export async function getFinanceDashboard(): Promise<DashboardViewModel> {
  const sheetData = await fetchFinanceSheetData();
  return toDashboardViewModel(sheetData);
}

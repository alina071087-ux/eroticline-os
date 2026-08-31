import "server-only";

import * as XLSX from "xlsx";
import type { OneCStockParsedRow } from "@/lib/integrations/1c/stock-import-types";

const MAX_HEADER_SCAN_ROWS = 30;

export class OneCStockParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OneCStockParseError";
  }
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

export function normalizeStockBarcode(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if (Number.isInteger(value)) {
      return String(value);
    }
    return String(Math.trunc(value));
  }

  const text = String(value).trim();
  if (/^\d+\.0$/.test(text)) {
    return text.slice(0, -2);
  }

  return text;
}

export function parseStockNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const text = String(value).replace(/\s/g, "").replace(",", ".");
  const num = Number(text);
  return Number.isFinite(num) ? num : 0;
}

function shouldSkipStockRow(
  nomenclatureRaw: string,
  characteristicRaw: string,
  barcode: string,
): boolean {
  if (!nomenclatureRaw) {
    return true;
  }

  if (nomenclatureRaw.startsWith("Итого")) {
    return true;
  }

  if (nomenclatureRaw.includes("ИП") && !characteristicRaw && !barcode) {
    return true;
  }

  return false;
}

type StockHeaderIndexes = {
  headerRowIndex: number;
  nomIdx: number;
  charIdx: number;
  bcIdx: number;
  totalIdx: number;
  acceptedIdx: number;
  packedIdx: number;
};

function findStockHeaderRow(rows: unknown[][]): StockHeaderIndexes {
  for (
    let rowIndex = 0;
    rowIndex < Math.min(rows.length, MAX_HEADER_SCAN_ROWS);
    rowIndex += 1
  ) {
    const row = rows[rowIndex] ?? [];
    const headers = row.map((cell) => cellToString(cell));
    const nomIdx = headers.indexOf("Номенклатура");
    const charIdx = headers.indexOf("Характеристика");
    const bcIdx = headers.indexOf("Штрихкод");

    if (nomIdx < 0 || charIdx < 0 || bcIdx < 0) {
      continue;
    }

    const groupRow =
      rowIndex > 0 ? (rows[rowIndex - 1] ?? []).map((cell) => cellToString(cell)) : [];

    let totalIdx = headers.findIndex(
      (header, index) => header === "Остаток" && index > bcIdx,
    );
    if (totalIdx < 0) {
      totalIdx = bcIdx + 1;
    }

    let acceptedIdx = totalIdx + 1;
    let packedIdx = totalIdx + 2;

    if (groupRow.length > 0) {
      const groupTotalIdx = groupRow.indexOf("Итого по всем складам");
      const groupAcceptedIdx = groupRow.indexOf("Принято");
      const groupPackedIdx = groupRow.indexOf("Упаковано");

      if (groupTotalIdx >= 0) {
        totalIdx = groupTotalIdx;
      }
      if (groupAcceptedIdx >= 0) {
        acceptedIdx = groupAcceptedIdx;
      }
      if (groupPackedIdx >= 0) {
        packedIdx = groupPackedIdx;
      }
    }

    return {
      headerRowIndex: rowIndex,
      nomIdx,
      charIdx,
      bcIdx,
      totalIdx,
      acceptedIdx,
      packedIdx,
    };
  }

  throw new OneCStockParseError(
    "В файле не найдены обязательные колонки: Номенклатура, Характеристика, Штрихкод.",
  );
}

export function parseOneCStockExcelBuffer(buffer: Buffer): {
  rows: OneCStockParsedRow[];
  sheetName: string;
  headerRowIndex: number;
} {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheetName = workbook.SheetNames.includes("Лист_1")
    ? "Лист_1"
    : workbook.SheetNames[0];

  if (!sheetName) {
    throw new OneCStockParseError("Excel-файл не содержит листов.");
  }

  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    raw: true,
    defval: "",
  });

  const header = findStockHeaderRow(rows);
  const parsedRows: OneCStockParsedRow[] = [];

  for (
    let rowIndex = header.headerRowIndex + 1;
    rowIndex < rows.length;
    rowIndex += 1
  ) {
    const row = rows[rowIndex] ?? [];
    const nomenclatureRaw = cellToString(row[header.nomIdx]);
    const characteristicRaw = cellToString(row[header.charIdx]);
    const barcode = normalizeStockBarcode(row[header.bcIdx]);

    if (shouldSkipStockRow(nomenclatureRaw, characteristicRaw, barcode)) {
      continue;
    }

    parsedRows.push({
      rowNumber: rowIndex + 1,
      nomenclatureRaw,
      characteristicRaw,
      barcode,
      stockTotal: parseStockNumber(row[header.totalIdx]),
      stockAccepted: parseStockNumber(row[header.acceptedIdx]),
      stockPacked: parseStockNumber(row[header.packedIdx]),
    });
  }

  return {
    rows: parsedRows,
    sheetName,
    headerRowIndex: header.headerRowIndex + 1,
  };
}

export function extractStockDateFromFileName(fileName: string): string | null {
  const match = /(\d{4}-\d{2}-\d{2})/.exec(fileName);
  return match?.[1] ?? null;
}

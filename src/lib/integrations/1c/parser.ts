import "server-only";

import * as XLSX from "xlsx";
import type { OneCParsedRow } from "@/lib/integrations/1c/types";
import { REQUIRED_1C_COLUMNS } from "@/lib/integrations/1c/types";

const MAX_HEADER_SCAN_ROWS = 30;

export class OneCParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OneCParseError";
  }
}

export function normalizeBarcodeValue(value: unknown): string {
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
  if (text.endsWith(".0") && /^\d+\.0$/.test(text)) {
    return text.slice(0, -2);
  }

  return text;
}

export function parseNomenclature(raw: string): {
  article: string;
  productName: string;
  warnings: string[];
} {
  const text = raw.trim();
  const match = /^(\S+)\s+(.+)$/.exec(text);

  if (!match) {
    return {
      article: "",
      productName: text,
      warnings: ["Не удалось выделить артикул и название из «Номенклатура»"],
    };
  }

  return {
    article: match[1],
    productName: match[2].trim(),
    warnings: [],
  };
}

export function parseCharacteristic(raw: string): {
  color: string;
  size: string;
  warnings: string[];
} {
  const text = raw.trim();

  if (!text) {
    return {
      color: "",
      size: "",
      warnings: ["Пустая «Характеристика»"],
    };
  }

  if (!text.includes(", ")) {
    return {
      color: text,
      size: "",
      warnings: [
        "Не удалось однозначно выделить цвет и размер из «Характеристика»",
      ],
    };
  }

  const splitIndex = text.lastIndexOf(", ");
  const color = text.slice(0, splitIndex).trim();
  const size = text.slice(splitIndex + 2).trim();

  if (!color || !size) {
    return {
      color,
      size,
      warnings: [
        "Не удалось однозначно выделить цвет и размер из «Характеристика»",
      ],
    };
  }

  return { color, size, warnings: [] };
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function findHeaderRow(rows: unknown[][]): {
  headerRowIndex: number;
  columnIndexes: Record<(typeof REQUIRED_1C_COLUMNS)[number], number>;
} {
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, MAX_HEADER_SCAN_ROWS); rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const headers = row.map((cell) => cellToString(cell));
    const indexes: Partial<Record<(typeof REQUIRED_1C_COLUMNS)[number], number>> = {};

    for (const columnName of REQUIRED_1C_COLUMNS) {
      const columnIndex = headers.findIndex((header) => header === columnName);
      if (columnIndex >= 0) {
        indexes[columnName] = columnIndex;
      }
    }

    if (
      indexes["Номенклатура"] !== undefined &&
      indexes["Характеристика"] !== undefined &&
      indexes["Штрихкод"] !== undefined
    ) {
      return {
        headerRowIndex: rowIndex,
        columnIndexes: indexes as Record<
          (typeof REQUIRED_1C_COLUMNS)[number],
          number
        >,
      };
    }
  }

  throw new OneCParseError(
    "В файле не найдены обязательные колонки: Номенклатура, Характеристика, Штрихкод. Проверьте формат выгрузки 1С.",
  );
}

function shouldSkipRow(nomenclatureRaw: string, characteristicRaw: string): boolean {
  if (!nomenclatureRaw) {
    return true;
  }

  if (nomenclatureRaw.startsWith("Итого")) {
    return true;
  }

  if (nomenclatureRaw.includes("ИП") && !characteristicRaw) {
    return true;
  }

  return false;
}

export function parseOneCExcelBuffer(buffer: Buffer): OneCParsedRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new OneCParseError("Excel-файл не содержит листов.");
  }

  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    raw: false,
    defval: "",
  });

  const { headerRowIndex, columnIndexes } = findHeaderRow(rows);
  const parsedRows: OneCParsedRow[] = [];

  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const nomenclatureRaw = cellToString(row[columnIndexes["Номенклатура"]]);
    const characteristicRaw = cellToString(row[columnIndexes["Характеристика"]]);
    const barcode = normalizeBarcodeValue(row[columnIndexes["Штрихкод"]]);

    if (shouldSkipRow(nomenclatureRaw, characteristicRaw)) {
      continue;
    }

    const nomenclature = parseNomenclature(nomenclatureRaw);
    const characteristic = parseCharacteristic(characteristicRaw);
    const parseWarnings = [
      ...nomenclature.warnings,
      ...characteristic.warnings,
    ];

    if (!barcode) {
      parseWarnings.push("Пустой штрихкод");
    }

    parsedRows.push({
      rowNumber: rowIndex + 1,
      nomenclatureRaw,
      characteristicRaw,
      barcode,
      article: nomenclature.article,
      productName: nomenclature.productName,
      color: characteristic.color,
      size: characteristic.size,
      parseWarnings,
    });
  }

  return parsedRows;
}

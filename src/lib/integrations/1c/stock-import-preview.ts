import "server-only";

import { fetchSkuItemsMap } from "@/lib/integrations/1c/sku-repository";
import { hashStockFile, readDefaultStockFile } from "@/lib/integrations/1c/stock-file";
import type { StockImportPreviewResult } from "@/lib/integrations/1c/stock-import-types";
import {
  OneCStockParseError,
  extractStockDateFromFileName,
  parseOneCStockExcelBuffer,
} from "@/lib/integrations/1c/stock-parser";
import {
  buildStockExamples,
  computeStockTotals,
  reconcileStockRows,
  validateStockArithmetic,
} from "@/lib/integrations/1c/stock-reconciliation";

function buildPreviewResult(
  partial: Omit<StockImportPreviewResult, "source" | "fetchedAt">,
): StockImportPreviewResult {
  return {
    source: "1c",
    fetchedAt: new Date().toISOString(),
    ...partial,
  };
}

export async function previewOneCStockImport(): Promise<StockImportPreviewResult> {
  const startedAt = Date.now();

  let buffer: Buffer;
  let fileName: string;

  try {
    const file = readDefaultStockFile();
    buffer = file.buffer;
    fileName = file.fileName;
  } catch (error) {
    return buildPreviewResult({
      status: "error",
      fileName: "",
      fileHash: "",
      stockDate: "",
      durationMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : "Stock file not found",
      rows: [],
      matched: 0,
      unmatched: 0,
      totals: { stockTotal: 0, stockAccepted: 0, stockPacked: 0 },
      arithmeticMismatches: [],
      examples: {},
      error: {
        code: "FILE_NOT_FOUND",
        message: error instanceof Error ? error.message : "Stock file not found",
      },
    });
  }

  const fileHash = hashStockFile(buffer);
  const stockDate = extractStockDateFromFileName(fileName);

  if (!stockDate) {
    return buildPreviewResult({
      status: "error",
      fileName,
      fileHash,
      stockDate: "",
      durationMs: Date.now() - startedAt,
      message: "Не удалось определить stock_date из имени файла",
      rows: [],
      matched: 0,
      unmatched: 0,
      totals: { stockTotal: 0, stockAccepted: 0, stockPacked: 0 },
      arithmeticMismatches: [],
      examples: {},
      error: {
        code: "INVALID_FILE",
        message: "Не удалось определить stock_date из имени файла",
      },
    });
  }

  let parsedRows;
  try {
    parsedRows = parseOneCStockExcelBuffer(buffer).rows;
  } catch (error) {
    const message =
      error instanceof OneCStockParseError
        ? error.message
        : "Не удалось прочитать Excel-файл остатков";

    return buildPreviewResult({
      status: "error",
      fileName,
      fileHash,
      stockDate,
      durationMs: Date.now() - startedAt,
      message,
      rows: [],
      matched: 0,
      unmatched: 0,
      totals: { stockTotal: 0, stockAccepted: 0, stockPacked: 0 },
      arithmeticMismatches: [],
      examples: {},
      error: {
        code: "PARSE_ERROR",
        message,
      },
    });
  }

  if (parsedRows.length === 0) {
    return buildPreviewResult({
      status: "error",
      fileName,
      fileHash,
      stockDate,
      durationMs: Date.now() - startedAt,
      message: "Файл не содержит строк остатков",
      rows: [],
      matched: 0,
      unmatched: 0,
      totals: { stockTotal: 0, stockAccepted: 0, stockPacked: 0 },
      arithmeticMismatches: [],
      examples: {},
      error: {
        code: "EMPTY_FILE",
        message: "Файл не содержит строк остатков",
      },
    });
  }

  const arithmeticMismatches = validateStockArithmetic(parsedRows);
  const totals = computeStockTotals(parsedRows);
  const examples = buildStockExamples(parsedRows);

  try {
    const skuByBarcode = await fetchSkuItemsMap();
    const { reconciledRows, matched, unmatched, unmatchedAudit } = reconcileStockRows(
      parsedRows,
      skuByBarcode,
    );

    return buildPreviewResult({
      status: "ok",
      fileName,
      fileHash,
      stockDate,
      durationMs: Date.now() - startedAt,
      message: `Preview готов: ${parsedRows.length} строк, matched ${matched}, unmatched ${unmatched}.`,
      rows: reconciledRows,
      matched,
      unmatched,
      totals,
      arithmeticMismatches,
      examples,
      unmatchedAudit,
    });
  } catch (error) {
    return buildPreviewResult({
      status: "error",
      fileName,
      fileHash,
      stockDate,
      durationMs: Date.now() - startedAt,
      message: "Не удалось сопоставить остатки со справочником",
      rows: [],
      matched: 0,
      unmatched: 0,
      totals,
      arithmeticMismatches,
      examples,
      error: {
        code: "DATABASE_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Не удалось сопоставить остатки со справочником",
      },
    });
  }
}

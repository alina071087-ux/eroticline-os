import "server-only";

import { fetchSkuItemsMap } from "@/lib/integrations/1c/sku-repository";
import { hashStockFile, readDefaultStockFile } from "@/lib/integrations/1c/stock-file";
import type { StockImportCommitResult } from "@/lib/integrations/1c/stock-import-types";
import {
  OneCStockParseError,
  extractStockDateFromFileName,
  parseOneCStockExcelBuffer,
} from "@/lib/integrations/1c/stock-parser";
import {
  computeStockTotals,
  reconcileStockRows,
  validateStockArithmetic,
} from "@/lib/integrations/1c/stock-reconciliation";
import {
  fetchStockImportByHash,
  insertStockImport,
  insertStockSnapshots,
} from "@/lib/integrations/1c/stock-repository";

function buildCommitResult(
  partial: Omit<StockImportCommitResult, "source" | "fetchedAt">,
): StockImportCommitResult {
  return {
    source: "1c",
    fetchedAt: new Date().toISOString(),
    ...partial,
  };
}

export async function commitOneCStockImport(): Promise<StockImportCommitResult> {
  const startedAt = Date.now();

  let buffer: Buffer;
  let fileName: string;

  try {
    const file = readDefaultStockFile();
    buffer = file.buffer;
    fileName = file.fileName;
  } catch (error) {
    return buildCommitResult({
      status: "error",
      stockImportId: "",
      fileName: "",
      stockDate: "",
      durationMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : "Stock file not found",
      totalRows: 0,
      matchedRows: 0,
      unmatchedRows: 0,
      totals: { stockTotal: 0, stockAccepted: 0, stockPacked: 0 },
      unknownSkuItemsCount: 0,
      error: {
        code: "FILE_NOT_FOUND",
        message: error instanceof Error ? error.message : "Stock file not found",
      },
    });
  }

  const fileHash = hashStockFile(buffer);
  const stockDate = extractStockDateFromFileName(fileName);

  if (!stockDate) {
    return buildCommitResult({
      status: "error",
      stockImportId: "",
      fileName,
      stockDate: "",
      durationMs: Date.now() - startedAt,
      message: "Не удалось определить stock_date из имени файла",
      totalRows: 0,
      matchedRows: 0,
      unmatchedRows: 0,
      totals: { stockTotal: 0, stockAccepted: 0, stockPacked: 0 },
      unknownSkuItemsCount: 0,
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

    return buildCommitResult({
      status: "error",
      stockImportId: "",
      fileName,
      stockDate,
      durationMs: Date.now() - startedAt,
      message,
      totalRows: 0,
      matchedRows: 0,
      unmatchedRows: 0,
      totals: { stockTotal: 0, stockAccepted: 0, stockPacked: 0 },
      unknownSkuItemsCount: 0,
      error: {
        code: "PARSE_ERROR",
        message,
      },
    });
  }

  const arithmeticMismatches = validateStockArithmetic(parsedRows);
  if (arithmeticMismatches.length > 0) {
    return buildCommitResult({
      status: "error",
      stockImportId: "",
      fileName,
      stockDate,
      durationMs: Date.now() - startedAt,
      message: "Commit отменён: есть арифметические расхождения в файле",
      totalRows: parsedRows.length,
      matchedRows: 0,
      unmatchedRows: 0,
      totals: computeStockTotals(parsedRows),
      unknownSkuItemsCount: 0,
      error: {
        code: "ARITHMETIC_MISMATCH",
        message: "Commit отменён: есть арифметические расхождения в файле",
      },
    });
  }

  const emptyBarcodes = parsedRows.filter((row) => !row.barcode).length;
  if (emptyBarcodes > 0) {
    return buildCommitResult({
      status: "error",
      stockImportId: "",
      fileName,
      stockDate,
      durationMs: Date.now() - startedAt,
      message: "Commit отменён: в файле есть строки с пустым штрихкодом",
      totalRows: parsedRows.length,
      matchedRows: 0,
      unmatchedRows: 0,
      totals: computeStockTotals(parsedRows),
      unknownSkuItemsCount: 0,
      error: {
        code: "VALIDATION_ERROR",
        message: "Commit отменён: в файле есть строки с пустым штрихкодом",
      },
    });
  }

  try {
    const existingImport = await fetchStockImportByHash("1c", stockDate, fileHash);
    if (existingImport) {
      return buildCommitResult({
        status: "error",
        stockImportId: existingImport.id,
        fileName,
        stockDate,
        durationMs: Date.now() - startedAt,
        message: "Этот файл уже импортирован",
        totalRows: existingImport.total_rows,
        matchedRows: existingImport.matched_rows,
        unmatchedRows: existingImport.unmatched_rows,
        totals: {
          stockTotal: existingImport.total_stock,
          stockAccepted: existingImport.total_accepted,
          stockPacked: existingImport.total_packed,
        },
        unknownSkuItemsCount: 0,
        error: {
          code: "ALREADY_IMPORTED",
          message: "Этот файл уже импортирован",
        },
      });
    }

    const skuByBarcode = await fetchSkuItemsMap();
    const { reconciledRows, matched, unmatched } = reconcileStockRows(
      parsedRows,
      skuByBarcode,
    );
    const totals = computeStockTotals(parsedRows);
    const fileBarcodes = new Set(parsedRows.map((row) => row.barcode));
    const unknownSkuItemsCount = [...skuByBarcode.keys()].filter(
      (barcode) => !fileBarcodes.has(barcode),
    ).length;

    const stockImportId = await insertStockImport({
      source: "1c",
      stockDate,
      fileName,
      fileHash,
      status: "committed",
      totalRows: parsedRows.length,
      matchedRows: matched,
      unmatchedRows: unmatched,
      totalStock: totals.stockTotal,
      totalAccepted: totals.stockAccepted,
      totalPacked: totals.stockPacked,
    });

    await insertStockSnapshots(stockImportId, stockDate, reconciledRows);

    return buildCommitResult({
      status: "ok",
      stockImportId,
      fileName,
      stockDate,
      durationMs: Date.now() - startedAt,
      message: "Snapshot остатков 1С сохранён",
      totalRows: parsedRows.length,
      matchedRows: matched,
      unmatchedRows: unmatched,
      totals,
      unknownSkuItemsCount,
    });
  } catch (error) {
    return buildCommitResult({
      status: "error",
      stockImportId: "",
      fileName,
      stockDate,
      durationMs: Date.now() - startedAt,
      message: "Не удалось сохранить snapshot остатков",
      totalRows: parsedRows.length,
      matchedRows: 0,
      unmatchedRows: 0,
      totals: computeStockTotals(parsedRows),
      unknownSkuItemsCount: 0,
      error: {
        code: "DATABASE_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Не удалось сохранить snapshot остатков",
      },
    });
  }
}

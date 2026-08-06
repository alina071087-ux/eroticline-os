import "server-only";

import { OneCParseError, parseOneCExcelBuffer } from "@/lib/integrations/1c/parser";
import {
  buildMatchingMetrics,
  buildOzonBarcodeIndex,
  buildWbBarcodeIndex,
  reconcileOneCRows,
} from "@/lib/integrations/1c/reconciliation";
import type { OneCSkuAuditResult, OneCError } from "@/lib/integrations/1c/types";
import { validateOneCRows } from "@/lib/integrations/1c/validation";
import type { IntegrationError } from "@/lib/integrations/types";
import { fetchOzonInventory } from "@/lib/integrations/ozon/inventory";
import { fetchWbProducts } from "@/lib/integrations/wb/products";

function mapIntegrationError(error: IntegrationError): OneCError {
  return {
    code: "API_ERROR",
    message: error.message,
  };
}

function buildResult(
  partial: Omit<OneCSkuAuditResult, "source" | "fetchedAt">,
): OneCSkuAuditResult {
  return {
    source: "1c",
    fetchedAt: new Date().toISOString(),
    ...partial,
  };
}

export async function auditOneCSkuFile(
  buffer: Buffer,
  fileName: string,
): Promise<OneCSkuAuditResult> {
  const startedAt = Date.now();

  let parsedRows;
  try {
    parsedRows = parseOneCExcelBuffer(buffer);
  } catch (error) {
    if (error instanceof OneCParseError) {
      return buildResult({
        status: "error",
        fileName,
        durationMs: Date.now() - startedAt,
        message: error.message,
        error: {
          code: "INVALID_FILE",
          message: error.message,
        },
      });
    }

    return buildResult({
      status: "error",
      fileName,
      durationMs: Date.now() - startedAt,
      message: "Не удалось прочитать Excel-файл",
      error: {
        code: "PARSE_ERROR",
        message: "Не удалось прочитать Excel-файл. Проверьте формат .xlsx.",
      },
    });
  }

  if (parsedRows.length === 0) {
    return buildResult({
      status: "error",
      fileName,
      durationMs: Date.now() - startedAt,
      message: "Файл не содержит строк данных",
      error: {
        code: "EMPTY_FILE",
        message: "Файл не содержит строк данных после заголовков.",
      },
    });
  }

  const validation = validateOneCRows(parsedRows);

  const [wbResult, ozonResult] = await Promise.all([
    fetchWbProducts(),
    fetchOzonInventory(),
  ]);

  const partialErrors: OneCSkuAuditResult["partialErrors"] = {};
  const wbOk = wbResult.status === "ok";
  const ozonOk = ozonResult.status === "ok";

  if (!wbOk && wbResult.error) {
    partialErrors.wbProducts = wbResult.error;
  }

  if (!ozonOk && ozonResult.error) {
    partialErrors.ozonInventory = ozonResult.error;
  }

  if (!wbOk && !ozonOk) {
    return buildResult({
      status: "error",
      fileName,
      durationMs: Date.now() - startedAt,
      message: "Не удалось загрузить данные маркетплейсов для сверки",
      error: wbResult.error
        ? mapIntegrationError(wbResult.error)
        : ozonResult.error
          ? mapIntegrationError(ozonResult.error)
          : {
              code: "API_ERROR",
              message: "Не удалось загрузить данные маркетплейсов",
            },
      fileQuality: validation.metrics,
      partialErrors,
    });
  }

  const wbProducts = wbOk ? (wbResult.products ?? []) : [];
  const ozonItems = ozonOk ? (ozonResult.items ?? []) : [];

  const wbIndex = buildWbBarcodeIndex(wbProducts);
  const ozonIndex = buildOzonBarcodeIndex(ozonItems);
  const reconciledRows = reconcileOneCRows(
    parsedRows,
    validation.duplicateBarcodes,
    wbIndex,
    ozonIndex,
  );

  const oneCBarcodes = new Set(
    parsedRows.map((row) => row.barcode).filter(Boolean),
  );
  const matching = buildMatchingMetrics(
    reconciledRows,
    oneCBarcodes,
    wbIndex,
    ozonIndex,
  );

  const hasPartialError = Boolean(
    !wbOk ||
      !ozonOk ||
      ozonResult.isComplete === false ||
      partialErrors.wbProducts ||
      partialErrors.ozonInventory,
  );

  return buildResult({
    status: hasPartialError ? "partial" : "ok",
    fileName,
    durationMs: Date.now() - startedAt,
    message: `Проверено строк: ${validation.metrics.totalRows}. Совпадений WB + Ozon: ${matching.matchedAll}. Покрытие: ${matching.coveragePercent}%.`,
    fileQuality: validation.metrics,
    matching,
    rows: reconciledRows,
    partialErrors: Object.keys(partialErrors).length > 0 ? partialErrors : undefined,
  });
}

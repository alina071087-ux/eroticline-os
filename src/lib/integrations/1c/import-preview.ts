import "server-only";

import { auditOneCSkuFile } from "@/lib/integrations/1c/audit";
import {
  buildImportPreviewRows,
  validateCommitRows,
} from "@/lib/integrations/1c/import-changes";
import type { SkuImportPreviewResult } from "@/lib/integrations/1c/import-types";
import {
  createSkuImportPreview,
  fetchSkuItemsMap,
} from "@/lib/integrations/1c/sku-repository";

function buildPreviewResult(
  partial: Omit<SkuImportPreviewResult, "source" | "fetchedAt">,
): SkuImportPreviewResult {
  return {
    source: "1c",
    fetchedAt: new Date().toISOString(),
    ...partial,
  };
}

async function loadExistingByBarcode() {
  return fetchSkuItemsMap();
}

export async function previewOneCSkuImport(
  buffer: Buffer,
  fileName: string,
): Promise<SkuImportPreviewResult> {
  const startedAt = Date.now();
  const audit = await auditOneCSkuFile(buffer, fileName);

  if (audit.status === "error" && !audit.rows?.length) {
    return buildPreviewResult({
      status: "error",
      importPreviewId: "",
      fileName,
      durationMs: Date.now() - startedAt,
      message: audit.message,
      error: {
        code: audit.error?.code ?? "API_ERROR",
        message: audit.error?.message ?? audit.message ?? "Ошибка preview",
      },
    });
  }

  const rows = audit.rows ?? [];
  const validation = validateCommitRows(rows);

  if (validation.validRows.length === 0) {
    return buildPreviewResult({
      status: "error",
      importPreviewId: "",
      fileName,
      durationMs: Date.now() - startedAt,
      message: "Нет валидных строк для сохранения",
      error: {
        code: "VALIDATION_ERROR",
        message: validation.errors[0] ?? "Нет валидных строк для сохранения",
      },
    });
  }

  try {
    const existingByBarcode = await loadExistingByBarcode();
    const { previewRows, summary } = buildImportPreviewRows(rows, existingByBarcode);

    const importPreviewId = await createSkuImportPreview({
      fileName,
      totalRows: audit.fileQuality?.totalRows ?? rows.length,
      validRows: audit.fileQuality?.validRows ?? validation.validRows.length,
      matchedAll: audit.matching?.matchedAll ?? 0,
      matchedWbOnly: audit.matching?.matchedWbOnly ?? 0,
      matchedOzonOnly: audit.matching?.matchedOzonOnly ?? 0,
      unmatched: audit.matching?.unmatched ?? 0,
      ambiguous: audit.matching?.ambiguous ?? 0,
      coveragePercent: audit.matching?.coveragePercent ?? 0,
      errorCount: summary.errorCount,
      previewPayload: rows,
    });

    return buildPreviewResult({
      status: audit.status === "partial" ? "partial" : "ok",
      importPreviewId,
      fileName,
      durationMs: Date.now() - startedAt,
      message: `Preview готов. К сохранению: ${summary.totalToSave}. Новых: ${summary.newCount}, обновлений: ${summary.updateCount}.`,
      metrics: audit.fileQuality && audit.matching
        ? { fileQuality: audit.fileQuality, matching: audit.matching }
        : undefined,
      rows: previewRows,
      changesSummary: summary,
    });
  } catch (error) {
    return buildPreviewResult({
      status: "error",
      importPreviewId: "",
      fileName,
      durationMs: Date.now() - startedAt,
      message: "Не удалось подготовить preview импорта",
      error: {
        code: "DATABASE_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Не удалось подготовить preview импорта",
      },
    });
  }
}

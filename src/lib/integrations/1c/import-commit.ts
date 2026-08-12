import "server-only";

import {
  buildImportPreviewRows,
  reconciliationRowToSkuItemInsert,
  validateCommitRows,
} from "@/lib/integrations/1c/import-changes";
import type { SkuImportCommitResult } from "@/lib/integrations/1c/import-types";
import {
  fetchSkuImportById,
  fetchSkuItemsMap,
  finalizeSkuImport,
  markSkuImportFailed,
  upsertSkuItems,
} from "@/lib/integrations/1c/sku-repository";

function buildCommitResult(
  partial: Omit<SkuImportCommitResult, "source" | "fetchedAt">,
): SkuImportCommitResult {
  return {
    source: "1c",
    fetchedAt: new Date().toISOString(),
    ...partial,
  };
}

export async function commitOneCSkuImport(
  importPreviewId: string,
): Promise<SkuImportCommitResult> {
  const startedAt = Date.now();

  if (!importPreviewId.trim()) {
    return buildCommitResult({
      status: "error",
      importId: "",
      importPreviewId: "",
      durationMs: Date.now() - startedAt,
      message: "Не передан importPreviewId",
      addedCount: 0,
      updatedCount: 0,
      unchangedCount: 0,
      errorCount: 0,
      error: {
        code: "VALIDATION_ERROR",
        message: "Не передан importPreviewId",
      },
    });
  }

  try {
    const importRecord = await fetchSkuImportById(importPreviewId);

    if (!importRecord) {
      return buildCommitResult({
        status: "error",
        importId: importPreviewId,
        importPreviewId,
        durationMs: Date.now() - startedAt,
        message: "Preview импорта не найден",
        addedCount: 0,
        updatedCount: 0,
        unchangedCount: 0,
        errorCount: 0,
        error: {
          code: "NOT_FOUND",
          message: "Preview импорта не найден или устарел",
        },
      });
    }

    if (
      importRecord.status === "committed" ||
      importRecord.status === "completed"
    ) {
      return buildCommitResult({
        status: "error",
        importId: importRecord.id,
        importPreviewId,
        durationMs: Date.now() - startedAt,
        message: "Этот импорт уже сохранён",
        addedCount: importRecord.added_count,
        updatedCount: importRecord.updated_count,
        unchangedCount: importRecord.unchanged_count,
        errorCount: importRecord.error_count,
        importedAt: importRecord.imported_at,
        error: {
          code: "ALREADY_COMMITTED",
          message: "Этот импорт уже сохранён",
        },
      });
    }

    if (importRecord.status !== "preview") {
      return buildCommitResult({
        status: "error",
        importId: importRecord.id,
        importPreviewId,
        durationMs: Date.now() - startedAt,
        message: "Импорт нельзя сохранить повторно",
        addedCount: 0,
        updatedCount: 0,
        unchangedCount: 0,
        errorCount: importRecord.error_count,
        error: {
          code: "INVALID_STATUS",
          message: `Статус импорта: ${importRecord.status}`,
        },
      });
    }

    const payloadRows = importRecord.preview_payload ?? [];
    const validation = validateCommitRows(payloadRows);

    if (validation.errors.length > 0) {
      await markSkuImportFailed(importRecord.id, validation.errors.length);
      return buildCommitResult({
        status: "error",
        importId: importRecord.id,
        importPreviewId,
        durationMs: Date.now() - startedAt,
        message: "Импорт не выполнен из-за ошибок валидации",
        addedCount: 0,
        updatedCount: 0,
        unchangedCount: 0,
        errorCount: validation.errors.length,
        error: {
          code: "VALIDATION_ERROR",
          message: validation.errors[0],
        },
      });
    }

    const existingByBarcode = await fetchSkuItemsMap();
    const { summary } = buildImportPreviewRows(payloadRows, existingByBarcode);

    const rowsToUpsert = validation.validRows.map((row) =>
      reconciliationRowToSkuItemInsert(row, importRecord.id),
    );

    await upsertSkuItems(rowsToUpsert);

    const importedAt = await finalizeSkuImport(importRecord.id, {
      addedCount: summary.newCount,
      updatedCount: summary.updateCount,
      unchangedCount: summary.unchangedCount,
      errorCount: summary.errorCount,
      status: "committed",
    });

    return buildCommitResult({
      status: "ok",
      importId: importRecord.id,
      importPreviewId,
      durationMs: Date.now() - startedAt,
      message: "Справочник обновлён",
      addedCount: summary.newCount,
      updatedCount: summary.updateCount,
      unchangedCount: summary.unchangedCount,
      errorCount: summary.errorCount,
      importedAt,
    });
  } catch (error) {
    try {
      await markSkuImportFailed(importPreviewId, 1);
    } catch {
      // Ignore secondary failure while reporting primary error.
    }

    return buildCommitResult({
      status: "error",
      importId: importPreviewId,
      importPreviewId,
      durationMs: Date.now() - startedAt,
      message: "Не удалось сохранить справочник",
      addedCount: 0,
      updatedCount: 0,
      unchangedCount: 0,
      errorCount: 1,
      error: {
        code: "DATABASE_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Не удалось сохранить справочник",
      },
    });
  }
}

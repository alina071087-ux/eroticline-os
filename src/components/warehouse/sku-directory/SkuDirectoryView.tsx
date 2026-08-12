"use client";

import { Download, RefreshCw, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { OneCSkuAuditResult } from "@/lib/integrations/1c/types";
import {
  buildSkuCatalogQuery,
  downloadSkuAuditCsv,
  filterReconciliationRows,
  formatDateTime,
  formatInventoryNumber,
  getSafeErrorMessage,
} from "@/lib/data/skuDirectoryPage";
import type {
  SkuCatalogFilters,
  SkuCatalogItem,
  SkuDirectoryFilters,
  SkuDirectoryViewMode,
  SkuImportCommitResult,
  SkuImportHistoryItem,
  SkuImportPreviewResult,
} from "@/lib/types/skuDirectoryPage";
import { SkuDirectoryCatalogFilters } from "./SkuDirectoryCatalogFilters";
import { SkuDirectoryCatalogTable } from "./SkuDirectoryCatalogTable";
import { SkuDirectoryChangesSummary } from "./SkuDirectoryChangesSummary";
import { SkuDirectoryFileQuality } from "./SkuDirectoryFileQuality";
import { SkuDirectoryFiltersBar } from "./SkuDirectoryFilters";
import { SkuDirectoryImportHistory } from "./SkuDirectoryImportHistory";
import { SkuDirectoryMatchMetrics } from "./SkuDirectoryMatchMetrics";
import { SkuDirectoryPartialLoadWarning } from "./SkuDirectoryPartialLoadWarning";
import { SkuDirectoryPreviewTable } from "./SkuDirectoryPreviewTable";
import {
  SkuDirectoryEmptyResults,
  SkuDirectoryEmptyUpload,
  SkuDirectoryError,
  SkuDirectoryLoading,
} from "./SkuDirectoryStates";
import { SkuDirectoryTable } from "./SkuDirectoryTable";
import { SkuDirectoryUpload } from "./SkuDirectoryUpload";
import { SkuDirectoryWarning } from "./SkuDirectoryWarning";

type LoadState = "idle" | "loading" | "success" | "error";

const defaultFilters: SkuDirectoryFilters = {
  search: "",
  matchStatus: "all",
  onlyWithErrors: false,
  onlyUnmatched: false,
  onlyMatchedBoth: false,
};

const defaultCatalogFilters: SkuCatalogFilters = {
  search: "",
  article: "",
  color: "",
  size: "",
  matchStatus: "all",
  platform: "all",
  onlyWithoutWb: false,
  onlyWithoutOzon: false,
};

export function SkuDirectoryView() {
  const [viewMode, setViewMode] = useState<SkuDirectoryViewMode>("upload");
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [previewState, setPreviewState] = useState<LoadState>("idle");
  const [commitState, setCommitState] = useState<LoadState>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<OneCSkuAuditResult | null>(null);
  const [preview, setPreview] = useState<SkuImportPreviewResult | null>(null);
  const [commitResult, setCommitResult] = useState<SkuImportCommitResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filters, setFilters] = useState<SkuDirectoryFilters>(defaultFilters);
  const [catalogFilters, setCatalogFilters] =
    useState<SkuCatalogFilters>(defaultCatalogFilters);
  const [importHistory, setImportHistory] = useState<SkuImportHistoryItem[]>([]);
  const [catalogItems, setCatalogItems] = useState<SkuCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const loadImportHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/integrations/1c/sku-imports", {
        cache: "no-store",
      });
      const payload = (await response.json()) as { items?: SkuImportHistoryItem[] };
      setImportHistory(payload.items ?? []);
    } catch {
      setImportHistory([]);
    }
  }, []);

  const loadCatalog = useCallback(async (filtersToApply: SkuCatalogFilters) => {
    setCatalogLoading(true);

    try {
      const response = await fetch(
        `/api/integrations/1c/sku-items${buildSkuCatalogQuery(filtersToApply)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as { items?: SkuCatalogItem[] };
      setCatalogItems(payload.items ?? []);
    } catch {
      setCatalogItems([]);
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadImportHistory();
    void loadCatalog(defaultCatalogFilters);
  }, [loadCatalog, loadImportHistory]);

  useEffect(() => {
    if (viewMode === "catalog") {
      void loadCatalog(catalogFilters);
    }
  }, [catalogFilters, loadCatalog, viewMode]);

  const runPreview = useCallback(async (file: File) => {
    setPreviewState("loading");
    setPreview(null);
    setCommitResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/integrations/1c/sku-import/preview", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as SkuImportPreviewResult;

      if (payload.status === "error") {
        setPreview(payload);
        setPreviewState("error");
        return;
      }

      setPreview(payload);
      setPreviewState("success");
    } catch {
      setPreviewState("error");
    }
  }, []);

  const submitAudit = useCallback(
    async (file: File) => {
      setLoadState("loading");
      setErrorMessage(null);
      setPreview(null);
      setCommitResult(null);
      setPreviewState("idle");

      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("/api/integrations/1c/sku-audit", {
          method: "POST",
          body: formData,
        });

        const payload = (await response.json()) as OneCSkuAuditResult;

        if (payload.status === "error" && !payload.rows?.length) {
          setResult(payload);
          setErrorMessage(getSafeErrorMessage(payload.message ?? payload.error?.message));
          setLoadState("error");
          return;
        }

        setResult(payload);
        setLoadState("success");
        await runPreview(file);
      } catch {
        setErrorMessage(
          "Не удалось связаться с сервером. Проверьте подключение и попробуйте снова.",
        );
        setLoadState("error");
      }
    },
    [runPreview],
  );

  const handleFileSelect = (file: File | null) => {
    setSelectedFile(file);
    setFileName(file?.name ?? null);
    setResult(null);
    setPreview(null);
    setCommitResult(null);
    setErrorMessage(null);
    setLoadState("idle");
    setPreviewState("idle");
    setCommitState("idle");
    setFilters(defaultFilters);
    setViewMode("upload");
  };

  const handleSubmit = () => {
    if (!selectedFile) {
      return;
    }

    void submitAudit(selectedFile);
  };

  const handleRetry = () => {
    if (selectedFile) {
      void submitAudit(selectedFile);
      return;
    }

    setLoadState("idle");
    setErrorMessage(null);
    setResult(null);
    setPreview(null);
    setCommitResult(null);
  };

  const handleCommit = async () => {
    if (!preview?.importPreviewId || !preview.changesSummary) {
      return;
    }

    const summary = preview.changesSummary;
    const confirmed = window.confirm(
      `Будет добавлено: ${summary.newCount}\nБудет обновлено: ${summary.updateCount}\nБез изменений: ${summary.unchangedCount}\nУдаления: 0\n\nПродолжить?`,
    );

    if (!confirmed) {
      return;
    }

    setCommitState("loading");

    try {
      const response = await fetch("/api/integrations/1c/sku-import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importPreviewId: preview.importPreviewId }),
      });

      const payload = (await response.json()) as SkuImportCommitResult;
      setCommitResult(payload);

      if (payload.status === "ok") {
        setCommitState("success");
        await loadImportHistory();
        await loadCatalog(catalogFilters);
        return;
      }

      setCommitState("error");
    } catch {
      setCommitState("error");
    }
  };

  const rows = useMemo(() => result?.rows ?? [], [result?.rows]);
  const filteredRows = useMemo(
    () => filterReconciliationRows(rows, filters),
    [rows, filters],
  );
  const previewRows = preview?.rows ?? [];

  const exportFileName = useMemo(() => {
    const base = (result?.fileName ?? "1c-sku-audit").replace(/\.xlsx$/i, "");
    return `${base}-reconciliation.csv`;
  }, [result?.fileName]);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 border-b border-white/[0.06] pb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
              Справочник SKU
            </h2>
            <p className="mt-1.5 text-sm text-zinc-400">
              Загрузка Excel из 1С, проверка качества, сверка с маркетплейсами и
              сохранение справочника в Supabase
            </p>
          </div>

          <div className="inline-flex rounded-xl border border-white/[0.08] bg-[#111113] p-1">
            <button
              type="button"
              onClick={() => setViewMode("upload")}
              className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                viewMode === "upload"
                  ? "bg-white/[0.08] text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Результат последней загрузки
            </button>
            <button
              type="button"
              onClick={() => setViewMode("catalog")}
              className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                viewMode === "catalog"
                  ? "bg-white/[0.08] text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Текущий справочник
            </button>
          </div>
        </div>
      </header>

      <div className="space-y-4">
        <SkuDirectoryUpload
          fileName={fileName}
          isSubmitting={loadState === "loading" || previewState === "loading"}
          onFileSelect={handleFileSelect}
          onSubmit={handleSubmit}
        />

        {viewMode === "upload" && (
          <>
            {loadState === "idle" && !fileName && <SkuDirectoryEmptyUpload />}
            {loadState === "idle" && fileName && <SkuDirectoryEmptyResults />}
            {loadState === "loading" && <SkuDirectoryLoading />}
            {loadState === "error" && (
              <SkuDirectoryError
                message={errorMessage ?? "Ошибка проверки"}
                onRetry={handleRetry}
              />
            )}

            {loadState === "success" && result && (
              <>
                {result.status === "partial" && (
                  <SkuDirectoryPartialLoadWarning result={result} />
                )}

                {result.fileQuality && (
                  <SkuDirectoryFileQuality metrics={result.fileQuality} />
                )}

                {result.matching && (
                  <SkuDirectoryMatchMetrics metrics={result.matching} />
                )}

                <SkuDirectoryWarning />

                {previewState === "loading" && (
                  <SkuDirectoryLoading message="Подготовка preview и сравнение с Supabase…" />
                )}

                {preview?.changesSummary && previewState === "success" && (
                  <SkuDirectoryChangesSummary summary={preview.changesSummary} />
                )}

                {preview?.importPreviewId && previewState === "success" && (
                  <div className="flex flex-wrap gap-2 px-1">
                    <button
                      type="button"
                      disabled={commitState === "loading"}
                      onClick={() => void handleCommit()}
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 transition-colors hover:bg-emerald-500/15 disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" strokeWidth={1.75} />
                      {commitState === "loading"
                        ? "Сохранение…"
                        : "Сохранить в справочник"}
                    </button>
                  </div>
                )}

                {commitResult?.status === "ok" && (
                  <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-4 text-sm text-emerald-100">
                    <p className="font-medium text-emerald-200">Справочник обновлён</p>
                    <p className="mt-2">
                      Добавлено: {formatInventoryNumber(commitResult.addedCount)} ·
                      Обновлено: {formatInventoryNumber(commitResult.updatedCount)} ·
                      Без изменений:{" "}
                      {formatInventoryNumber(commitResult.unchangedCount)} ·
                      Ошибок: {formatInventoryNumber(commitResult.errorCount)}
                    </p>
                    {commitResult.importedAt && (
                      <p className="mt-1 text-emerald-100/80">
                        Дата обновления: {formatDateTime(commitResult.importedAt)}
                      </p>
                    )}
                  </section>
                )}

                {commitResult?.status === "error" && (
                  <SkuDirectoryError
                    message={commitResult.message ?? commitResult.error?.message ?? "Ошибка сохранения"}
                    onRetry={() => void handleCommit()}
                  />
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                  <p className="text-sm text-zinc-400">{result.message}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => downloadSkuAuditCsv(rows, exportFileName)}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#111113] px-3 py-2 text-sm text-zinc-200 transition-colors hover:border-white/[0.14]"
                    >
                      <Download className="h-4 w-4" strokeWidth={1.75} />
                      Скачать результат CSV
                    </button>
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#111113] px-3 py-2 text-sm text-zinc-200 transition-colors hover:border-white/[0.14]"
                    >
                      <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
                      Проверить повторно
                    </button>
                  </div>
                </div>

                {previewRows.length > 0 ? (
                  <SkuDirectoryPreviewTable rows={previewRows} />
                ) : (
                  <>
                    <SkuDirectoryFiltersBar
                      filters={filters}
                      onFiltersChange={setFilters}
                    />
                    {filteredRows.length > 0 ? (
                      <SkuDirectoryTable rows={filteredRows} />
                    ) : (
                      <section className="rounded-2xl border border-white/[0.06] bg-[#111113] px-6 py-10 text-center text-sm text-zinc-400">
                        Нет строк, подходящих под выбранные фильтры.
                      </section>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}

        <SkuDirectoryImportHistory items={importHistory} />

        {viewMode === "catalog" && (
          <>
            <SkuDirectoryCatalogFilters
              filters={catalogFilters}
              onFiltersChange={setCatalogFilters}
            />
            {catalogLoading ? (
              <SkuDirectoryLoading message="Загрузка текущего справочника…" />
            ) : catalogItems.length > 0 ? (
              <SkuDirectoryCatalogTable rows={catalogItems} />
            ) : (
              <section className="rounded-2xl border border-white/[0.06] bg-[#111113] px-6 py-10 text-center text-sm text-zinc-400">
                Справочник SKU пока пуст.
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { Download, RefreshCw } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { OneCSkuAuditResult } from "@/lib/integrations/1c/types";
import {
  downloadSkuAuditCsv,
  filterReconciliationRows,
  getSafeErrorMessage,
} from "@/lib/data/skuDirectoryPage";
import type { SkuDirectoryFilters } from "@/lib/types/skuDirectoryPage";
import { SkuDirectoryFileQuality } from "./SkuDirectoryFileQuality";
import { SkuDirectoryFiltersBar } from "./SkuDirectoryFilters";
import { SkuDirectoryMatchMetrics } from "./SkuDirectoryMatchMetrics";
import { SkuDirectoryPartialLoadWarning } from "./SkuDirectoryPartialLoadWarning";
import {
  SkuDirectoryEmptyResults,
  SkuDirectoryEmptyUpload,
  SkuDirectoryError,
  SkuDirectoryLoading,
} from "./SkuDirectoryStates";
import { SkuDirectoryTable } from "./SkuDirectoryTable";
import { SkuDirectoryUpload } from "./SkuDirectoryUpload";
import { SkuDirectoryWarning } from "./SkuDirectoryWarning";

type ViewState =
  | "idle"
  | "loading"
  | "success"
  | "error";

const defaultFilters: SkuDirectoryFilters = {
  search: "",
  matchStatus: "all",
  onlyWithErrors: false,
  onlyUnmatched: false,
  onlyMatchedBoth: false,
};

export function SkuDirectoryView() {
  const [viewState, setViewState] = useState<ViewState>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<OneCSkuAuditResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filters, setFilters] = useState<SkuDirectoryFilters>(defaultFilters);

  const submitAudit = useCallback(async (file: File) => {
    setViewState("loading");
    setErrorMessage(null);

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
        setViewState("error");
        return;
      }

      setResult(payload);
      setViewState("success");
    } catch {
      setErrorMessage(
        "Не удалось связаться с сервером. Проверьте подключение и попробуйте снова.",
      );
      setViewState("error");
    }
  }, []);

  const handleFileSelect = (file: File | null) => {
    setSelectedFile(file);
    setFileName(file?.name ?? null);
    setResult(null);
    setErrorMessage(null);
    setViewState("idle");
    setFilters(defaultFilters);
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

    setViewState("idle");
    setErrorMessage(null);
    setResult(null);
  };

  const rows = useMemo(() => result?.rows ?? [], [result?.rows]);

  const filteredRows = useMemo(
    () => filterReconciliationRows(rows, filters),
    [rows, filters],
  );

  const exportFileName = useMemo(() => {
    const base = (result?.fileName ?? "1c-sku-audit").replace(/\.xlsx$/i, "");
    return `${base}-reconciliation.csv`;
  }, [result?.fileName]);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 border-b border-white/[0.06] pb-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
            Справочник SKU
          </h2>
          <p className="mt-1.5 text-sm text-zinc-400">
            Загрузка Excel из 1С, проверка качества справочника и сверка
            штрихкодов с Wildberries и Ozon
          </p>
        </div>
      </header>

      <div className="space-y-4">
        <SkuDirectoryUpload
          fileName={fileName}
          isSubmitting={viewState === "loading"}
          onFileSelect={handleFileSelect}
          onSubmit={handleSubmit}
        />

        {viewState === "idle" && !fileName && <SkuDirectoryEmptyUpload />}
        {viewState === "idle" && fileName && <SkuDirectoryEmptyResults />}
        {viewState === "loading" && <SkuDirectoryLoading />}
        {viewState === "error" && (
          <SkuDirectoryError message={errorMessage ?? "Ошибка проверки"} onRetry={handleRetry} />
        )}

        {viewState === "success" && result && (
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

            <SkuDirectoryFiltersBar filters={filters} onFiltersChange={setFilters} />

            {filteredRows.length > 0 ? (
              <SkuDirectoryTable rows={filteredRows} />
            ) : (
              <section className="rounded-2xl border border-white/[0.06] bg-[#111113] px-6 py-10 text-center text-sm text-zinc-400">
                Нет строк, подходящих под выбранные фильтры.
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

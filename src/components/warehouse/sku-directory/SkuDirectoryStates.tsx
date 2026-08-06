"use client";

import {
  AlertCircle,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Upload,
} from "lucide-react";

type SkuDirectoryLoadingProps = {
  message?: string;
};

export function SkuDirectoryLoading({
  message = "Проверка файла 1С и сверка с маркетплейсами…",
}: SkuDirectoryLoadingProps) {
  return (
    <section className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-[#111113] px-6 py-12 text-center shadow-[0_1px_2px_rgba(0,0,0,0.35),0_8px_24px_rgba(0,0,0,0.2)]">
      <Loader2
        className="h-8 w-8 animate-spin text-violet-400"
        strokeWidth={1.75}
      />
      <p className="mt-4 text-sm text-zinc-400">{message}</p>
    </section>
  );
}

type SkuDirectoryErrorProps = {
  message: string;
  onRetry?: () => void;
};

export function SkuDirectoryError({ message, onRetry }: SkuDirectoryErrorProps) {
  return (
    <section className="rounded-2xl border border-red-500/20 bg-red-500/5 px-6 py-8 shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-red-200">Ошибка проверки</h3>
          <p className="mt-1 text-sm text-red-200/80">{message}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-100 transition-colors hover:bg-red-500/15"
            >
              <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
              Проверить повторно
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export function SkuDirectoryEmptyUpload() {
  return (
    <section className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-[#111113] px-6 py-10 text-center">
      <FileSpreadsheet className="h-8 w-8 text-zinc-500" strokeWidth={1.5} />
      <p className="mt-4 text-sm text-zinc-400">
        Выберите Excel-файл из 1С и нажмите «Проверить файл».
      </p>
    </section>
  );
}

export function SkuDirectoryEmptyResults() {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-[#111113] px-6 py-10 text-center">
      <Upload className="mx-auto h-8 w-8 text-zinc-500" strokeWidth={1.5} />
      <p className="mt-4 text-sm text-zinc-400">
        После проверки здесь появятся метрики качества и таблица сверки.
      </p>
    </section>
  );
}

"use client";

import { FileSpreadsheet, Upload } from "lucide-react";

type SkuDirectoryUploadProps = {
  fileName: string | null;
  isSubmitting: boolean;
  onFileSelect: (file: File | null) => void;
  onSubmit: () => void;
};

export function SkuDirectoryUpload({
  fileName,
  isSubmitting,
  onFileSelect,
  onSubmit,
}: SkuDirectoryUploadProps) {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-[#111113] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.35),0_8px_24px_rgba(0,0,0,0.2)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Загрузка Excel из 1С
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            Поддерживается формат .xlsx до 20 МБ. Файл обрабатывается только на
            сервере и не отправляется напрямую в маркетплейсы.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/[0.08] bg-[#0d0d0f] px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-white/[0.14]">
              <Upload className="h-4 w-4" strokeWidth={1.75} />
              Выбрать Excel из 1С
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(event) => {
                  onFileSelect(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
              />
            </label>

            <button
              type="button"
              disabled={!fileName || isSubmitting}
              onClick={onSubmit}
              className="inline-flex items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-200 transition-colors hover:bg-violet-500/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Проверка…" : "Проверить файл"}
            </button>
          </div>
        </div>

        {fileName && (
          <div className="flex min-w-0 items-center gap-2 rounded-xl border border-white/[0.06] bg-[#0d0d0f] px-3 py-2 text-sm text-zinc-300">
            <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-400" strokeWidth={1.75} />
            <span className="truncate">{fileName}</span>
          </div>
        )}
      </div>
    </section>
  );
}

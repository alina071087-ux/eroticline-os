"use client";

import {
  AlertCircle,
  Loader2,
  PackageOpen,
  RefreshCw,
} from "lucide-react";

type MarketplaceInventoryLoadingProps = {
  message?: string;
};

export function MarketplaceInventoryLoading({
  message = "Загрузка остатков маркетплейсов…",
}: MarketplaceInventoryLoadingProps) {
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

type MarketplaceInventoryErrorProps = {
  message: string;
  onRetryAll: () => void;
  onRetryWb?: () => void;
  onRetryOzon?: () => void;
  showPartialActions?: boolean;
};

export function MarketplaceInventoryError({
  message,
  onRetryAll,
  onRetryWb,
  onRetryOzon,
  showPartialActions = false,
}: MarketplaceInventoryErrorProps) {
  return (
    <section className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/5 px-6 py-12 text-center shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
      <AlertCircle className="h-8 w-8 text-red-400" strokeWidth={1.75} />
      <p className="mt-4 max-w-lg text-sm leading-relaxed text-red-100/90">
        {message}
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={onRetryAll}
          className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#111113] px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-[#141416]"
        >
          <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
          Повторить всё
        </button>
        {showPartialActions && onRetryWb && (
          <button
            type="button"
            onClick={onRetryWb}
            className="inline-flex items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-200 transition-colors hover:bg-violet-500/15"
          >
            Повторить WB
          </button>
        )}
        {showPartialActions && onRetryOzon && (
          <button
            type="button"
            onClick={onRetryOzon}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-200 transition-colors hover:bg-blue-500/15"
          >
            Повторить Ozon
          </button>
        )}
      </div>
    </section>
  );
}

export function MarketplaceInventoryEmpty() {
  return (
    <section className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-[#111113] px-6 py-12 text-center shadow-[0_1px_2px_rgba(0,0,0,0.35),0_8px_24px_rgba(0,0,0,0.2)]">
      <PackageOpen className="h-8 w-8 text-zinc-500" strokeWidth={1.75} />
      <p className="mt-4 text-sm text-zinc-400">
        По выбранным фильтрам товары не найдены.
      </p>
    </section>
  );
}

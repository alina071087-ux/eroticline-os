"use client";

import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Package,
  Warehouse,
} from "lucide-react";
import type { MarketplaceInventoryResult } from "@/lib/integrations/marketplaces/types";
import {
  formatFetchedAt,
  formatInventoryNumber,
  getSafeErrorMessage,
} from "@/lib/data/marketplaceInventoryPage";

type MarketplacePlatformCardsProps = {
  result: MarketplaceInventoryResult;
  loadState: "loading" | "success" | "error";
  onRetry: () => void;
};

function LoadStatusBadge({
  state,
}: {
  state: "loading" | "success" | "error";
}) {
  if (state === "loading") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-500/20 bg-zinc-500/10 px-2.5 py-1 text-xs font-medium text-zinc-300">
        <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.75} />
        Загрузка
      </span>
    );
  }

  if (state === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-300">
        <AlertCircle className="h-3 w-3" strokeWidth={1.75} />
        Ошибка
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
      <CheckCircle2 className="h-3 w-3" strokeWidth={1.75} />
      Загружено
    </span>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-zinc-400">{label}</span>
      <span className="font-medium text-zinc-100">{value}</span>
    </div>
  );
}

export function MarketplacePlatformCards({
  result,
  loadState,
  onRetry,
}: MarketplacePlatformCardsProps) {
  const wb = result.wb;
  const ozon = result.ozon;
  const wbState =
    loadState === "loading"
      ? "loading"
      : wb?.status === "ok"
        ? "success"
        : "error";
  const ozonState =
    loadState === "loading"
      ? "loading"
      : ozon?.status === "ok"
        ? "success"
        : "error";

  return (
    <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <article className="rounded-2xl border border-white/[0.06] bg-[#111113] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.35),0_8px_24px_rgba(0,0,0,0.2)]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15">
              <Package className="h-5 w-5 text-violet-400" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-50">
                Wildberries
              </h3>
              {wb?.fetchedAt && wbState === "success" && (
                <p className="text-xs text-zinc-500" suppressHydrationWarning>
                  Получено: {formatFetchedAt(wb.fetchedAt)}
                </p>
              )}
            </div>
          </div>
          <LoadStatusBadge state={wbState} />
        </div>

        {wbState === "error" && (
          <p className="mb-4 text-sm text-red-200/90">
            {wb?.error?.message ??
              result.partialErrors?.wbInventory?.message ??
              result.partialErrors?.wbProducts?.message ??
              "Не удалось загрузить Wildberries"}
          </p>
        )}

        {wb && wbState === "success" && (
          <div className="space-y-2.5">
            <MetricRow
              label="Остаток"
              value={formatInventoryNumber(wb.quantity)}
            />
            <MetricRow
              label="В пути к покупателям"
              value={formatInventoryNumber(wb.inWayToClient)}
            />
            <MetricRow
              label="Возврат в пути"
              value={formatInventoryNumber(wb.inWayFromClient)}
            />
            <MetricRow
              label="Товаров"
              value={formatInventoryNumber(wb.productCount)}
            />
            <MetricRow
              label="Складов"
              value={formatInventoryNumber(wb.warehouseCount)}
            />
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {wbState === "error" && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg border border-white/[0.08] bg-[#141416] px-3 py-2 text-sm text-zinc-200 transition-colors hover:bg-[#18181b]"
            >
              Повторить всё
            </button>
          )}
          <Link
            href="/warehouse/marketplaces/wildberries"
            className="inline-flex items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-sm font-medium text-violet-200 transition-colors hover:bg-violet-500/15"
          >
            Открыть Wildberries
            <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </div>
      </article>

      <article className="rounded-2xl border border-white/[0.06] bg-[#111113] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.35),0_8px_24px_rgba(0,0,0,0.2)]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15">
              <Warehouse className="h-5 w-5 text-blue-400" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-50">Ozon</h3>
              {ozon?.fetchedAt && ozonState === "success" && (
                <p className="text-xs text-zinc-500" suppressHydrationWarning>
                  Получено: {formatFetchedAt(ozon.fetchedAt)}
                </p>
              )}
            </div>
          </div>
          <LoadStatusBadge state={ozonState} />
        </div>

        {ozonState === "error" && (
          <p className="mb-4 text-sm text-red-200/90">
            {ozon?.error?.message ??
              result.partialErrors?.ozonInventory?.message ??
              "Не удалось загрузить Ozon"}
          </p>
        )}

        {ozon && ozonState === "success" && (
          <div className="space-y-2.5">
            <MetricRow
              label="Учтено в остатках"
              value={formatInventoryNumber(ozon.present)}
            />
            <MetricRow
              label="Резерв"
              value={formatInventoryNumber(ozon.reserved)}
            />
            <MetricRow
              label="Расчётный остаток API"
              value={formatInventoryNumber(ozon.available)}
            />
            <MetricRow
              label="Товаров"
              value={formatInventoryNumber(ozon.productCount)}
            />
            <MetricRow
              label="Строк остатков"
              value={formatInventoryNumber(ozon.rowCount)}
            />
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {ozonState === "error" && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg border border-white/[0.08] bg-[#141416] px-3 py-2 text-sm text-zinc-200 transition-colors hover:bg-[#18181b]"
            >
              Повторить всё
            </button>
          )}
          <Link
            href="/warehouse/marketplaces/ozon"
            className="inline-flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-200 transition-colors hover:bg-blue-500/15"
          >
            Открыть Ozon
            <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </div>
      </article>
    </section>
  );
}

export function getMarketplaceErrorMessage(
  result: MarketplaceInventoryResult | null,
  fallback: string,
): string {
  if (!result) {
    return fallback;
  }

  return getSafeErrorMessage(result.error?.message ?? result.message);
}

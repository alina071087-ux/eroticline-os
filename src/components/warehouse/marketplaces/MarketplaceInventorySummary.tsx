"use client";

import type { MarketplaceInventoryResult } from "@/lib/integrations/marketplaces/types";
import {
  Lock,
  Package,
  ShoppingBag,
  Truck,
  Undo2,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { formatInventoryNumber } from "@/lib/data/marketplaceInventoryPage";

type MetricCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  accent: string;
  bg: string;
};

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accent,
  bg,
}: MetricCardProps) {
  return (
    <article className="group rounded-2xl border border-white/[0.06] bg-[#111113] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.35),0_8px_24px_rgba(0,0,0,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:border-white/[0.1] hover:bg-[#141416]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <p className="text-xs font-medium text-zinc-400">{title}</p>
          <p className="text-lg font-semibold tracking-tight text-zinc-50 sm:text-xl">
            {value}
          </p>
          {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
        </div>
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${bg}`}
        >
          <Icon className={`h-4 w-4 ${accent}`} strokeWidth={1.75} />
        </div>
      </div>
    </article>
  );
}

type MarketplaceInventorySummaryProps = {
  result: MarketplaceInventoryResult;
};

export function MarketplaceInventorySummary({
  result,
}: MarketplaceInventorySummaryProps) {
  const summary = result.summary;
  const wbAvailable = result.wb?.status === "ok";
  const ozonAvailable = result.ozon?.status === "ok";

  if (!summary) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="px-1">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Общая сводка
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Показатели площадок показаны отдельно и не суммируются в один общий
          остаток.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {wbAvailable && (
          <>
            <MetricCard
              title="Wildberries, на складах"
              value={formatInventoryNumber(summary.wbQuantity)}
              subtitle="сумма quantity · granularity nmID"
              icon={Package}
              accent="text-violet-400"
              bg="bg-violet-500/15"
            />
            <MetricCard
              title="Wildberries, в пути к покупателям"
              value={formatInventoryNumber(summary.wbInWayToClient)}
              subtitle="сумма inWayToClient"
              icon={Truck}
              accent="text-violet-300"
              bg="bg-violet-500/10"
            />
            <MetricCard
              title="Wildberries, возврат в пути"
              value={formatInventoryNumber(summary.wbInWayFromClient)}
              subtitle="сумма inWayFromClient"
              icon={Undo2}
              accent="text-violet-200"
              bg="bg-violet-500/10"
            />
          </>
        )}

        {ozonAvailable && (
          <>
            <MetricCard
              title="Ozon, учтено в остатках"
              value={formatInventoryNumber(summary.ozonPresent)}
              subtitle="totals.present"
              icon={Warehouse}
              accent="text-blue-400"
              bg="bg-blue-500/15"
            />
            <MetricCard
              title="Ozon, в резерве"
              value={formatInventoryNumber(summary.ozonReserved)}
              subtitle="totals.reserved"
              icon={Lock}
              accent="text-amber-400"
              bg="bg-amber-500/15"
            />
            <MetricCard
              title="Ozon, расчётный остаток API"
              value={formatInventoryNumber(summary.ozonAvailable)}
              subtitle="totals.available · present − reserved"
              icon={ShoppingBag}
              accent="text-cyan-400"
              bg="bg-cyan-500/10"
            />
          </>
        )}
      </section>
    </div>
  );
}

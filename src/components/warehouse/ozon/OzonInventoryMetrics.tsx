"use client";

import {
  Boxes,
  CheckCircle2,
  Layers,
  Lock,
  Package,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";
import type { OzonInventoryPageMetrics } from "@/lib/types/ozonInventoryPage";
import { formatInventoryNumber } from "@/lib/data/ozonInventoryPage";

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

type OzonInventoryMetricsProps = {
  metrics: OzonInventoryPageMetrics;
};

export function OzonInventoryMetrics({ metrics }: OzonInventoryMetricsProps) {
  const matchedRatio = `${metrics.matchedProductsCount} / ${metrics.totalUniqueProducts}`;

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      <MetricCard
        title="Всего на складах"
        value={formatInventoryNumber(metrics.totalPresent)}
        icon={Package}
        accent="text-emerald-400"
        bg="bg-emerald-500/15"
      />
      <MetricCard
        title="В резерве"
        value={formatInventoryNumber(metrics.totalReserved)}
        icon={Lock}
        accent="text-amber-400"
        bg="bg-amber-500/15"
      />
      <MetricCard
        title="Доступно к продаже"
        value={formatInventoryNumber(metrics.totalAvailable)}
        icon={ShoppingBag}
        accent="text-blue-400"
        bg="bg-blue-500/15"
      />
      <MetricCard
        title="Товаров с остатками"
        value={formatInventoryNumber(metrics.totalUniqueProducts)}
        icon={Boxes}
        accent="text-violet-400"
        bg="bg-violet-500/15"
      />
      <MetricCard
        title="Строк остатков"
        value={formatInventoryNumber(metrics.totalInventoryRows)}
        icon={Layers}
        accent="text-cyan-400"
        bg="bg-cyan-500/15"
      />
      <MetricCard
        title="Сопоставлено"
        value={matchedRatio}
        subtitle="matched / товаров"
        icon={CheckCircle2}
        accent="text-indigo-400"
        bg="bg-indigo-500/15"
      />
    </section>
  );
}

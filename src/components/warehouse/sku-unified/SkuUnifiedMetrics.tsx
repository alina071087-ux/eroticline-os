"use client";

import { formatInventoryNumber } from "@/lib/data/skuUnifiedPage";
import type { SkuUnifiedPageMetrics } from "@/lib/types/skuUnifiedPage";

type SkuUnifiedMetricsProps = {
  metrics: SkuUnifiedPageMetrics;
};

export function SkuUnifiedMetrics({ metrics }: SkuUnifiedMetricsProps) {
  const cards = [
    { title: "Всего SKU", value: metrics.totalSku },
    { title: "Есть на WB", value: metrics.skuWithWb },
    { title: "Есть на Ozon", value: metrics.skuWithOzon },
    { title: "Есть на обеих площадках", value: metrics.skuWithBoth },
    { title: "Нет ни одной площадки", value: metrics.skuWithoutMarketplaces },
    { title: "WB остаток = 0", value: metrics.wbZeroStock },
    { title: "Ozon остаток = 0", value: metrics.ozonZeroStock },
  ];

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
      {cards.map((card) => (
        <article
          key={card.title}
          className="rounded-2xl border border-white/[0.06] bg-[#111113] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
        >
          <p className="text-xs font-medium text-zinc-400">{card.title}</p>
          <p className="mt-1.5 text-lg font-semibold text-zinc-50">
            {formatInventoryNumber(card.value)}
          </p>
        </article>
      ))}
    </section>
  );
}

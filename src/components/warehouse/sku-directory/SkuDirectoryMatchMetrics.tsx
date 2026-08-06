"use client";

import type { OneCMatchingMetrics } from "@/lib/integrations/1c/types";
import {
  formatInventoryNumber,
  formatPercent,
} from "@/lib/data/skuDirectoryPage";

type SkuDirectoryMatchMetricsProps = {
  metrics: OneCMatchingMetrics;
};

export function SkuDirectoryMatchMetrics({
  metrics,
}: SkuDirectoryMatchMetricsProps) {
  const cards = [
    { title: "WB + Ozon", value: metrics.matchedAll },
    { title: "Только WB", value: metrics.matchedWbOnly },
    { title: "Только Ozon", value: metrics.matchedOzonOnly },
    { title: "Не найдено", value: metrics.unmatched },
    { title: "Неоднозначные", value: metrics.ambiguous },
    { title: "Невалидные", value: metrics.invalid },
    {
      title: "Штрихкодов WB вне файла 1С",
      value: metrics.wbBarcodesOutsideFile,
    },
    {
      title: "Штрихкодов Ozon вне файла 1С",
      value: metrics.ozonBarcodesOutsideFile,
    },
    { title: "Покрытие, %", value: formatPercent(metrics.coveragePercent) },
  ];

  return (
    <div className="space-y-3">
      <div className="px-1">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Сопоставление с площадками
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map((card) => (
          <article
            key={card.title}
            className="rounded-2xl border border-white/[0.06] bg-[#111113] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
          >
            <p className="text-xs font-medium text-zinc-400">{card.title}</p>
            <p className="mt-1.5 text-lg font-semibold text-zinc-50">
              {typeof card.value === "string"
                ? card.value
                : formatInventoryNumber(card.value)}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}

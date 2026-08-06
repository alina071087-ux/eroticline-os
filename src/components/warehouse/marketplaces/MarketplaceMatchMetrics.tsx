"use client";

import type { MarketplaceInventoryResult } from "@/lib/integrations/marketplaces/types";
import { formatInventoryNumber } from "@/lib/data/marketplaceInventoryPage";

type MarketplaceMatchMetricsProps = {
  result: MarketplaceInventoryResult;
};

export function MarketplaceMatchMetrics({ result }: MarketplaceMatchMetricsProps) {
  const quality = result.matchQuality;
  const audit = result.identifierAudit;

  if (!quality || !audit) {
    return null;
  }

  const cards = [
    { title: "По штрихкоду", value: quality.barcodeExact },
    { title: "По артикулу", value: quality.offerExact },
    {
      title: "По норм. артикулу",
      value: quality.offerNormalized,
    },
    { title: "Неоднозначные", value: quality.ambiguous },
    { title: "Только WB", value: quality.wbOnly },
    { title: "Только Ozon", value: quality.ozonOnly },
    { title: "Без идентификатора", value: quality.noIdentifier },
  ];

  return (
    <div className="space-y-3">
      <div className="px-1">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Качество сопоставления
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Объединено {formatInventoryNumber(quality.totalUnified)} строк. Найдено{" "}
          {formatInventoryNumber(audit.barcodeIntersections)} пересечений штрихкодов
          отдельных SKU. Автоматически объединено{" "}
          {formatInventoryNumber(quality.barcodeExact)} карточек WB и Ozon; ещё{" "}
          {formatInventoryNumber(quality.ambiguous)} карточек требуют уточнения,
          поскольку один nmID Wildberries содержит несколько размеров.
        </p>
      </div>

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

      <section className="rounded-2xl border border-white/[0.06] bg-[#111113] p-4 text-xs text-zinc-500">
        <p>
          WB nmID со штрихкодами:{" "}
          {formatInventoryNumber(audit.wbNmIdsWithBarcode)} /{" "}
          {formatInventoryNumber(audit.wbNmIdsWithStock)} · Уникальных штрихкодов
          WB: {formatInventoryNumber(audit.uniqueWbBarcodes)} · Ozon:{" "}
          {formatInventoryNumber(audit.uniqueOzonBarcodes)} · Совпадений по
          артикулу: {formatInventoryNumber(audit.offerExactIntersections)} · по
          нормализованному артикулу:{" "}
          {formatInventoryNumber(audit.offerNormalizedIntersections)}
        </p>
      </section>
    </div>
  );
}

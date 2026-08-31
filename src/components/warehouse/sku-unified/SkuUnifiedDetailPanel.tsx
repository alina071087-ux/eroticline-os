"use client";

import {
  formatDateTime,
  formatIdList,
  formatInventoryNumber,
  getMatchStatusLabel,
  getMatchStatusStyles,
  getSkuUnifiedWarningLabel,
  getSkuUnifiedWarningLevel,
  getVisibleWarnings,
  getWarningLevelStyles,
} from "@/lib/data/skuUnifiedPage";
import type { SkuUnifiedTableRow } from "@/lib/types/skuUnifiedPage";

type SkuUnifiedDetailPanelProps = {
  row: SkuUnifiedTableRow;
  fetchedAt: string;
  onClose: () => void;
};

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="text-sm text-zinc-200">{value}</p>
    </div>
  );
}

export function SkuUnifiedDetailPanel({
  row,
  fetchedAt,
  onClose,
}: SkuUnifiedDetailPanelProps) {
  const warningLevel = getSkuUnifiedWarningLevel(row);
  const warningLabel = getSkuUnifiedWarningLabel(row);
  const visibleWarnings = getVisibleWarnings(row);

  return (
    <>
      <button
        type="button"
        aria-label="Закрыть карточку SKU"
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-white/[0.08] bg-[#0d0d0f] shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Карточка SKU
            </p>
            <h3 className="mt-1 truncate text-lg font-semibold text-zinc-50">
              {row.productName || row.article || row.barcode}
            </h3>
            <p className="mt-1 font-mono text-xs text-zinc-400">{row.barcode}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/[0.08] p-2 text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-200"
          >
            ×
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section className="space-y-3">
            <h4 className="text-sm font-medium text-zinc-300">1С</h4>
            <div className="grid grid-cols-2 gap-4 rounded-xl border border-white/[0.06] bg-[#111113] p-4">
              <DetailField label="Артикул" value={row.article || "—"} />
              <DetailField label="Штрихкод" value={row.barcode} />
              <DetailField label="Размер" value={row.size || "—"} />
              <DetailField label="Цвет" value={row.color || "—"} />
              <DetailField label="Номенклатура" value={row.nomenclatureRaw || "—"} />
              <DetailField label="Характеристика" value={row.characteristicRaw || "—"} />
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-sm font-medium text-zinc-300">Wildberries</h4>
            <div className="grid grid-cols-2 gap-4 rounded-xl border border-violet-500/10 bg-violet-500/5 p-4">
              <DetailField label="nmID" value={formatIdList(row.wbNmIds)} />
              <DetailField label="chrtId" value={row.wbChrtId ? String(row.wbChrtId) : "—"} />
              <DetailField label="Размер WB" value={row.wbTechSize || "—"} />
              <DetailField label="Штрихкод WB" value={row.wbBarcode || "—"} />
              <DetailField
                label="Остаток размера"
                value={
                  row.wbMatchStatus === "matched"
                    ? formatInventoryNumber(row.wbQuantity)
                    : "—"
                }
              />
              <DetailField
                label="Общий остаток nmID"
                value={
                  row.wbNmIdTotalQuantity !== null
                    ? formatInventoryNumber(row.wbNmIdTotalQuantity)
                    : "—"
                }
              />
              <DetailField
                label="В пути к покупателю"
                value={
                  row.wbMatchStatus === "matched"
                    ? formatInventoryNumber(row.wbInWayToClient)
                    : "—"
                }
              />
              <DetailField
                label="Возврат в пути"
                value={
                  row.wbMatchStatus === "matched"
                    ? formatInventoryNumber(row.wbInWayFromClient)
                    : "—"
                }
              />
              <DetailField
                label="Гранулярность"
                value={row.wbStockGranularity === "size" ? "Размер (chrtId)" : "—"}
              />
            </div>

            {row.wbWarehouses.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#111113]">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-[#141416]">
                    <tr>
                      {["Склад", "Остаток", "К клиенту", "От клиента"].map((title) => (
                        <th
                          key={title}
                          className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500"
                        >
                          {title}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {row.wbWarehouses.map((warehouse) => (
                      <tr
                        key={`${warehouse.warehouseId ?? warehouse.warehouseName}`}
                        className="border-t border-white/[0.04] text-zinc-300"
                      >
                        <td className="px-3 py-2">{warehouse.warehouseName || "—"}</td>
                        <td className="px-3 py-2">{formatInventoryNumber(warehouse.quantity)}</td>
                        <td className="px-3 py-2">
                          {formatInventoryNumber(warehouse.inWayToClient)}
                        </td>
                        <td className="px-3 py-2">
                          {formatInventoryNumber(warehouse.inWayFromClient)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h4 className="text-sm font-medium text-zinc-300">Ozon</h4>
            <div className="grid grid-cols-2 gap-4 rounded-xl border border-blue-500/10 bg-blue-500/5 p-4">
              <DetailField label="productId" value={formatIdList(row.ozonProductIds)} />
              <DetailField label="offerId" value={formatIdList(row.ozonOfferIds)} />
              <DetailField
                label="Доступно"
                value={
                  row.ozonMatchStatus === "matched"
                    ? formatInventoryNumber(row.ozonAvailable)
                    : "—"
                }
              />
              <DetailField
                label="В наличии"
                value={
                  row.ozonMatchStatus === "matched"
                    ? formatInventoryNumber(row.ozonPresent)
                    : "—"
                }
              />
              <DetailField
                label="Зарезервировано"
                value={
                  row.ozonMatchStatus === "matched"
                    ? formatInventoryNumber(row.ozonReserved)
                    : "—"
                }
              />
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-sm font-medium text-zinc-300">Статус и предупреждения</h4>
            <div className="space-y-3 rounded-xl border border-white/[0.06] bg-[#111113] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getMatchStatusStyles(row.matchStatus)}`}
                >
                  {getMatchStatusLabel(row.matchStatus)}
                </span>
                {warningLevel !== "none" && (
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getWarningLevelStyles(warningLevel)}`}
                  >
                    {warningLabel}
                  </span>
                )}
              </div>
              {visibleWarnings.length > 0 && (
                <ul className="space-y-1 text-sm text-zinc-400">
                  {visibleWarnings.map((warning) => (
                    <li key={warning}>• {warning}</li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-sm font-medium text-zinc-300">История обновлений</h4>
            <div className="space-y-3 rounded-xl border border-white/[0.06] bg-[#111113] p-4">
              <DetailField
                label="Справочник 1С в Supabase"
                value={formatDateTime(row.updatedAt)}
              />
              <DetailField
                label="Последняя загрузка остатков"
                value={formatDateTime(fetchedAt)}
              />
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}

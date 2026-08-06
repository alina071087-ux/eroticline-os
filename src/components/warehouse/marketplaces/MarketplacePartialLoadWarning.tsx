import { AlertTriangle } from "lucide-react";

type MarketplacePartialLoadWarningProps = {
  wbIncomplete: boolean;
  ozonIncomplete: boolean;
};

export function MarketplacePartialLoadWarning({
  wbIncomplete,
  ozonIncomplete,
}: MarketplacePartialLoadWarningProps) {
  if (!wbIncomplete && !ozonIncomplete) {
    return null;
  }

  const messages: string[] = [];

  if (wbIncomplete) {
    messages.push("Wildberries");
  }

  if (ozonIncomplete) {
    messages.push("Ozon");
  }

  return (
    <section className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="mt-0.5 h-4 w-4 shrink-0 text-red-400"
          strokeWidth={1.75}
        />
        <p className="text-sm leading-relaxed text-red-100/90">
          Загружена только часть остатков: {messages.join(" и ")}. Сводка и
          таблица могут быть неполными.
        </p>
      </div>
    </section>
  );
}

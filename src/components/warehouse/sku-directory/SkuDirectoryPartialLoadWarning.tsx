"use client";

import type { OneCSkuAuditResult } from "@/lib/integrations/1c/types";

type SkuDirectoryPartialLoadWarningProps = {
  result: OneCSkuAuditResult;
};

export function SkuDirectoryPartialLoadWarning({
  result,
}: SkuDirectoryPartialLoadWarningProps) {
  const messages: string[] = [];

  if (result.partialErrors?.wbProducts) {
    messages.push(`Wildberries: ${result.partialErrors.wbProducts.message}`);
  }

  if (result.partialErrors?.ozonInventory) {
    messages.push(`Ozon: ${result.partialErrors.ozonInventory.message}`);
  }

  if (messages.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-100/90">
      <p className="font-medium text-amber-200">Частичная загрузка маркетплейсов</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-100/80">
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </section>
  );
}

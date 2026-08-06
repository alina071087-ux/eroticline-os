import "server-only";

import type { OzonInventoryItem } from "@/lib/integrations/ozon/types";
import type { WbInventoryItem, WbProductCard } from "@/lib/integrations/types";
import {
  confidenceForMethod,
  intersectBarcodes,
  normalizeBarcode,
  normalizeOfferId,
  uniqueStrings,
} from "@/lib/integrations/marketplaces/normalize";
import type {
  MarketplaceIdentifierAudit,
  MarketplaceMatchMethod,
  MarketplaceMatchQualityMetrics,
  MarketplaceUnifiedItem,
} from "@/lib/integrations/marketplaces/types";
import {
  extractBarcodesFromCard,
} from "@/lib/integrations/wb/product-cards";

type WbPreparedProduct = {
  nmID: number;
  vendorCode: string | null;
  vendorCodeNormalized: string | null;
  barcodes: string[];
  quantity: number;
  inWayToClient: number;
  inWayFromClient: number;
  title: string | null;
};

type OzonPreparedProduct = {
  productId: number;
  offerId: string;
  offerIdNormalized: string | null;
  barcodes: string[];
  available: number;
  present: number;
  reserved: number;
  name: string | null;
};

type MatchCandidate = {
  wb: WbPreparedProduct;
  ozon: OzonPreparedProduct;
  method: Exclude<MarketplaceMatchMethod, "wb_only" | "ozon_only" | "no_identifier" | "ambiguous">;
  sharedBarcodes: string[];
};

function aggregateWbInventory(
  items: WbInventoryItem[],
  cards: Map<number, WbProductCard>,
): WbPreparedProduct[] {
  const grouped = new Map<number, WbPreparedProduct>();

  for (const item of items) {
    const card = cards.get(item.nmID);
    const cardBarcodes = card ? extractBarcodesFromCard(card) : [];
    const vendorCode =
      item.vendorCode?.trim() ||
      card?.vendorCode?.trim() ||
      null;

    const existing = grouped.get(item.nmID);

    if (!existing) {
      grouped.set(item.nmID, {
        nmID: item.nmID,
        vendorCode,
        vendorCodeNormalized: normalizeOfferId(vendorCode),
        barcodes: uniqueStrings(cardBarcodes),
        quantity: item.quantity,
        inWayToClient: item.inWayToClient,
        inWayFromClient: item.inWayFromClient,
        title: item.title?.trim() || card?.title?.trim() || null,
      });
      continue;
    }

    grouped.set(item.nmID, {
      ...existing,
      quantity: existing.quantity + item.quantity,
      inWayToClient: existing.inWayToClient + item.inWayToClient,
      inWayFromClient: existing.inWayFromClient + item.inWayFromClient,
      vendorCode: existing.vendorCode ?? vendorCode,
      vendorCodeNormalized:
        existing.vendorCodeNormalized ?? normalizeOfferId(vendorCode),
      barcodes: uniqueStrings([...existing.barcodes, ...cardBarcodes]),
      title: existing.title ?? item.title?.trim() ?? card?.title?.trim() ?? null,
    });
  }

  return [...grouped.values()];
}

function extractOzonBarcodes(item: OzonInventoryItem): string[] {
  const barcodes: string[] = [];

  if (item.barcode?.trim()) {
    barcodes.push(item.barcode.trim());
  }

  if (item.barcodes?.length) {
    for (const barcode of item.barcodes) {
      if (barcode?.trim()) {
        barcodes.push(barcode.trim());
      }
    }
  }

  return uniqueStrings(barcodes);
}

function aggregateOzonInventory(items: OzonInventoryItem[]): OzonPreparedProduct[] {
  const grouped = new Map<number, OzonPreparedProduct>();

  for (const item of items) {
    const existing = grouped.get(item.productId);
    const offerId = item.offerId?.trim() || "—";
    const itemBarcodes = extractOzonBarcodes(item);

    if (!existing) {
      grouped.set(item.productId, {
        productId: item.productId,
        offerId,
        offerIdNormalized:
          offerId !== "—" ? normalizeOfferId(offerId) : null,
        barcodes: itemBarcodes,
        available: item.available,
        present: item.present,
        reserved: item.reserved,
        name: item.name?.trim() || null,
      });
      continue;
    }

    grouped.set(item.productId, {
      ...existing,
      available: existing.available + item.available,
      present: existing.present + item.present,
      reserved: existing.reserved + item.reserved,
      barcodes: uniqueStrings([...existing.barcodes, ...itemBarcodes]),
      offerId: existing.offerId !== "—" ? existing.offerId : offerId,
      offerIdNormalized:
        existing.offerIdNormalized ??
        (offerId !== "—" ? normalizeOfferId(offerId) : null),
      name: existing.name ?? item.name?.trim() ?? null,
    });
  }

  return [...grouped.values()];
}

function buildUnifiedItem(
  id: string,
  wb: WbPreparedProduct | null,
  ozon: OzonPreparedProduct | null,
  method: MarketplaceMatchMethod,
  sharedBarcodes: string[] = [],
  warnings: string[] = [],
): MarketplaceUnifiedItem {
  const offerId =
    wb?.vendorCode ??
    ozon?.offerId ??
    (wb ? `nmID ${wb.nmID}` : `product ${ozon?.productId}`);

  const title =
    ozon?.name ?? wb?.title ?? "Без названия";

  const wbQuantity = wb?.quantity ?? 0;
  const ozonAvailable = ozon?.available ?? 0;

  return {
    id,
    offerId,
    title,
    wbNmId: wb?.nmID ?? null,
    wbVendorCode: wb?.vendorCode ?? null,
    wbBarcodes: wb?.barcodes ?? [],
    wbQuantity,
    wbGranularity: wb ? "nmId" : null,
    ozonProductId: ozon?.productId ?? null,
    ozonOfferId: ozon?.offerId ?? null,
    ozonBarcodes: ozon?.barcodes ?? [],
    ozonAvailable,
    totalApi: wbQuantity + ozonAvailable,
    matchMethod: method,
    matchConfidence: confidenceForMethod(method),
    warnings,
  };
}

function buildBarcodeIndex<T extends { barcodes: string[] }>(
  products: T[],
): Map<string, T[]> {
  const index = new Map<string, T[]>();

  for (const product of products) {
    for (const barcode of product.barcodes) {
      const normalized = normalizeBarcode(barcode);
      if (!normalized) {
        continue;
      }

      const bucket = index.get(normalized) ?? [];
      bucket.push(product);
      index.set(normalized, bucket);
    }
  }

  return index;
}

function pickUniqueOzonByOffer(
  wbProduct: WbPreparedProduct,
  candidates: OzonPreparedProduct[],
): OzonPreparedProduct | null {
  if (candidates.length <= 1) {
    return candidates[0] ?? null;
  }

  if (wbProduct.vendorCode) {
    const exactMatches = candidates.filter(
      (product) => product.offerId === wbProduct.vendorCode,
    );

    if (exactMatches.length === 1) {
      return exactMatches[0];
    }
  }

  if (wbProduct.vendorCodeNormalized) {
    const normalizedMatches = candidates.filter(
      (product) =>
        product.offerIdNormalized === wbProduct.vendorCodeNormalized,
    );

    if (normalizedMatches.length === 1) {
      return normalizedMatches[0];
    }
  }

  return null;
}

function buildOfferIndex<T>(
  products: T[],
  getOffer: (product: T) => string | null,
): Map<string, T[]> {
  const index = new Map<string, T[]>();

  for (const product of products) {
    const offer = getOffer(product);
    if (!offer) {
      continue;
    }

    const bucket = index.get(offer) ?? [];
    bucket.push(product);
    index.set(offer, bucket);
  }

  return index;
}

function collectBarcodeIntersections(
  wbProducts: WbPreparedProduct[],
  ozonProducts: OzonPreparedProduct[],
): Set<string> {
  const ozonBarcodes = new Set<string>();

  for (const product of ozonProducts) {
    for (const barcode of product.barcodes) {
      const normalized = normalizeBarcode(barcode);
      if (normalized) {
        ozonBarcodes.add(normalized);
      }
    }
  }

  const intersections = new Set<string>();

  for (const product of wbProducts) {
    for (const barcode of product.barcodes) {
      const normalized = normalizeBarcode(barcode);
      if (normalized && ozonBarcodes.has(normalized)) {
        intersections.add(normalized);
      }
    }
  }

  return intersections;
}

function countOfferIntersections(
  wbProducts: WbPreparedProduct[],
  ozonProducts: OzonPreparedProduct[],
  useNormalized: boolean,
): number {
  const ozonOffers = new Set<string>();

  for (const product of ozonProducts) {
    const offer = useNormalized
      ? product.offerIdNormalized
      : product.offerId.trim() || null;
    if (offer) {
      ozonOffers.add(offer);
    }
  }

  let count = 0;

  for (const product of wbProducts) {
    const offer = useNormalized
      ? product.vendorCodeNormalized
      : product.vendorCode;
    if (offer && ozonOffers.has(offer)) {
      count += 1;
    }
  }

  return count;
}

function buildIdentifierAudit(
  wbProducts: WbPreparedProduct[],
  ozonProducts: OzonPreparedProduct[],
  unified: MarketplaceUnifiedItem[],
): MarketplaceIdentifierAudit {
  const wbBarcodes = new Set<string>();
  const ozonBarcodes = new Set<string>();

  for (const product of wbProducts) {
    for (const barcode of product.barcodes) {
      const normalized = normalizeBarcode(barcode);
      if (normalized) {
        wbBarcodes.add(normalized);
      }
    }
  }

  for (const product of ozonProducts) {
    for (const barcode of product.barcodes) {
      const normalized = normalizeBarcode(barcode);
      if (normalized) {
        ozonBarcodes.add(normalized);
      }
    }
  }

  const intersections = collectBarcodeIntersections(wbProducts, ozonProducts);

  const matched = unified.filter(
    (item) =>
      item.matchMethod === "barcode_exact" ||
      item.matchMethod === "offer_exact" ||
      item.matchMethod === "offer_normalized",
  );

  const mismatchedWb = wbProducts
    .filter((product) => product.quantity > 0)
    .filter(
      (product) =>
        !matched.some((item) => item.wbNmId === product.nmID) &&
        product.barcodes.length > 0,
    )
    .slice(0, 20)
    .map((product) => ({
      side: "wb" as const,
      identifier: product.vendorCode ?? `nmID ${product.nmID}`,
      nmId: product.nmID,
      offerId: product.vendorCode ?? undefined,
      barcodes: product.barcodes.slice(0, 3),
      reason: "Нет пары на Ozon по штрихкоду или артикулу",
    }));

  const mismatchedOzon = ozonProducts
    .filter((product) => product.available > 0)
    .filter(
      (product) =>
        !matched.some((item) => item.ozonProductId === product.productId) &&
        product.barcodes.length > 0,
    )
    .slice(0, 20)
    .map((product) => ({
      side: "ozon" as const,
      identifier: product.offerId,
      productId: product.productId,
      offerId: product.offerId,
      barcodes: product.barcodes.slice(0, 3),
      reason: "Нет пары на WB по штрихкоду или артикулу",
    }));

  return {
    wbNmIdsWithStock: wbProducts.filter((product) => product.quantity > 0).length,
    wbNmIdsWithBarcode: wbProducts.filter((product) => product.barcodes.length > 0)
      .length,
    uniqueWbBarcodes: wbBarcodes.size,
    uniqueOzonBarcodes: ozonBarcodes.size,
    barcodeIntersections: intersections.size,
    offerExactIntersections: countOfferIntersections(
      wbProducts,
      ozonProducts,
      false,
    ),
    offerNormalizedIntersections: countOfferIntersections(
      wbProducts,
      ozonProducts,
      true,
    ),
    matchExamples: matched.slice(0, 20).map((item) => ({
      method: item.matchMethod,
      wbNmId: item.wbNmId,
      wbVendorCode: item.wbVendorCode,
      ozonProductId: item.ozonProductId,
      ozonOfferId: item.ozonOfferId,
      sharedBarcodes: intersectBarcodes(item.wbBarcodes, item.ozonBarcodes).slice(
        0,
        3,
      ),
    })),
    mismatchExamples: [...mismatchedWb, ...mismatchedOzon].slice(0, 20),
  };
}

function buildMatchQuality(
  unified: MarketplaceUnifiedItem[],
): MarketplaceMatchQualityMetrics {
  let barcodeExact = 0;
  let offerExact = 0;
  let offerNormalized = 0;
  let ambiguous = 0;
  let wbOnly = 0;
  let ozonOnly = 0;
  let noIdentifier = 0;

  for (const item of unified) {
    switch (item.matchMethod) {
      case "barcode_exact":
        barcodeExact += 1;
        break;
      case "offer_exact":
        offerExact += 1;
        break;
      case "offer_normalized":
        offerNormalized += 1;
        break;
      case "ambiguous":
        ambiguous += 1;
        break;
      case "wb_only":
        wbOnly += 1;
        break;
      case "ozon_only":
        ozonOnly += 1;
        break;
      case "no_identifier":
        noIdentifier += 1;
        break;
    }
  }

  return {
    barcodeExact,
    offerExact,
    offerNormalized,
    ambiguous,
    wbOnly,
    ozonOnly,
    noIdentifier,
    totalUnified: unified.length,
  };
}

export function mergeMarketplaceInventory(
  wbItems: WbInventoryItem[],
  wbCards: Map<number, WbProductCard>,
  ozonItems: OzonInventoryItem[],
): {
  items: MarketplaceUnifiedItem[];
  matchQuality: MarketplaceMatchQualityMetrics;
  identifierAudit: MarketplaceIdentifierAudit;
} {
  const wbProducts = aggregateWbInventory(wbItems, wbCards);
  const ozonProducts = aggregateOzonInventory(ozonItems);

  const usedWb = new Set<number>();
  const usedOzon = new Set<number>();
  const unified: MarketplaceUnifiedItem[] = [];
  const barcodeMatches: MatchCandidate[] = [];

  const ozonByBarcode = buildBarcodeIndex(ozonProducts);

  for (const wbProduct of wbProducts) {
    const candidateOzon = new Map<number, OzonPreparedProduct>();
    const sharedByProduct = new Map<number, string[]>();

    for (const barcode of wbProduct.barcodes) {
      const normalized = normalizeBarcode(barcode);
      if (!normalized) {
        continue;
      }

      const ozonMatches = ozonByBarcode.get(normalized) ?? [];

      for (const ozonProduct of ozonMatches) {
        candidateOzon.set(ozonProduct.productId, ozonProduct);
        const shared = sharedByProduct.get(ozonProduct.productId) ?? [];
        shared.push(normalized);
        sharedByProduct.set(ozonProduct.productId, uniqueStrings(shared));
      }
    }

    const candidates = [...candidateOzon.values()];
    const resolvedOzon =
      candidates.length === 1
        ? candidates[0]
        : pickUniqueOzonByOffer(wbProduct, candidates);

    if (resolvedOzon) {
      barcodeMatches.push({
        wb: wbProduct,
        ozon: resolvedOzon,
        method: "barcode_exact",
        sharedBarcodes:
          sharedByProduct.get(resolvedOzon.productId) ?? [],
      });
    } else if (candidates.length > 1) {
      unified.push(
        buildUnifiedItem(
          `wb-ambiguous-${wbProduct.nmID}`,
          wbProduct,
          null,
          "ambiguous",
          [],
          [
            "Несколько товаров Ozon совпали по штрихкоду. Автообъединение отключено.",
          ],
        ),
      );
      usedWb.add(wbProduct.nmID);
    }
  }

  for (const match of barcodeMatches) {
    if (usedWb.has(match.wb.nmID) || usedOzon.has(match.ozon.productId)) {
      unified.push(
        buildUnifiedItem(
          `ambiguous-barcode-${match.wb.nmID}-${match.ozon.productId}`,
          match.wb,
          match.ozon,
          "ambiguous",
          match.sharedBarcodes,
          ["Конфликт сопоставления по штрихкоду."],
        ),
      );
      usedWb.add(match.wb.nmID);
      usedOzon.add(match.ozon.productId);
      continue;
    }

    unified.push(
      buildUnifiedItem(
        `match-barcode-${match.wb.nmID}-${match.ozon.productId}`,
        match.wb,
        match.ozon,
        "barcode_exact",
        match.sharedBarcodes,
        match.wb.barcodes.length > 0
          ? [
              "Остаток WB указан на уровне nmID и не распределён по размерам.",
            ]
          : [],
      ),
    );
    usedWb.add(match.wb.nmID);
    usedOzon.add(match.ozon.productId);
  }

  const remainingWb = wbProducts.filter((product) => !usedWb.has(product.nmID));
  const remainingOzon = ozonProducts.filter(
    (product) => !usedOzon.has(product.productId),
  );

  const ozonExactIndex = buildOfferIndex(
    remainingOzon,
    (product) => (product.offerId !== "—" ? product.offerId : null),
  );
  const ozonNormalizedIndex = buildOfferIndex(
    remainingOzon,
    (product) => product.offerIdNormalized,
  );

  for (const wbProduct of remainingWb) {
    if (!wbProduct.vendorCode) {
      continue;
    }

    const exactMatches = ozonExactIndex.get(wbProduct.vendorCode) ?? [];

    if (exactMatches.length === 1) {
      const ozonProduct = exactMatches[0];
      if (usedOzon.has(ozonProduct.productId)) {
        unified.push(
          buildUnifiedItem(
            `wb-ambiguous-offer-${wbProduct.nmID}`,
            wbProduct,
            null,
            "ambiguous",
            [],
            ["Артикул уже сопоставлен с другим товаром Ozon."],
          ),
        );
        usedWb.add(wbProduct.nmID);
        continue;
      }

      unified.push(
        buildUnifiedItem(
          `match-offer-${wbProduct.nmID}-${ozonProduct.productId}`,
          wbProduct,
          ozonProduct,
          "offer_exact",
          [],
          [
            "Сопоставление по точному артикулу продавца.",
            "Остаток WB указан на уровне nmID.",
          ],
        ),
      );
      usedWb.add(wbProduct.nmID);
      usedOzon.add(ozonProduct.productId);
      continue;
    }

    if (exactMatches.length > 1) {
      unified.push(
        buildUnifiedItem(
          `wb-ambiguous-offer-${wbProduct.nmID}`,
          wbProduct,
          null,
          "ambiguous",
          [],
          ["Несколько товаров Ozon с одинаковым артикулом."],
        ),
      );
      usedWb.add(wbProduct.nmID);
    }
  }

  const remainingWbAfterExact = wbProducts.filter(
    (product) => !usedWb.has(product.nmID),
  );
  const remainingOzonAfterExact = ozonProducts.filter(
    (product) => !usedOzon.has(product.productId),
  );

  const ozonNormalizedIndexFresh = buildOfferIndex(
    remainingOzonAfterExact,
    (product) => product.offerIdNormalized,
  );

  for (const wbProduct of remainingWbAfterExact) {
    if (!wbProduct.vendorCodeNormalized) {
      continue;
    }

    const normalizedMatches =
      ozonNormalizedIndexFresh.get(wbProduct.vendorCodeNormalized) ?? [];

    if (normalizedMatches.length === 1) {
      const ozonProduct = normalizedMatches[0];

      if (usedOzon.has(ozonProduct.productId)) {
        unified.push(
          buildUnifiedItem(
            `wb-ambiguous-normalized-${wbProduct.nmID}`,
            wbProduct,
            null,
            "ambiguous",
            [],
            ["Нормализованный артикул уже сопоставлен с другим товаром."],
          ),
        );
        usedWb.add(wbProduct.nmID);
        continue;
      }

      unified.push(
        buildUnifiedItem(
          `match-normalized-${wbProduct.nmID}-${ozonProduct.productId}`,
          wbProduct,
          ozonProduct,
          "offer_normalized",
          [],
          [
            "Сопоставление по нормализованному артикулу.",
            "Остаток WB указан на уровне nmID.",
          ],
        ),
      );
      usedWb.add(wbProduct.nmID);
      usedOzon.add(ozonProduct.productId);
      continue;
    }

    if (normalizedMatches.length > 1) {
      unified.push(
        buildUnifiedItem(
          `wb-ambiguous-normalized-${wbProduct.nmID}`,
          wbProduct,
          null,
          "ambiguous",
          [],
          ["Несколько товаров Ozon совпали по нормализованному артикулу."],
        ),
      );
      usedWb.add(wbProduct.nmID);
    }
  }

  for (const wbProduct of wbProducts) {
    if (usedWb.has(wbProduct.nmID)) {
      continue;
    }

    const hasIdentifier =
      Boolean(wbProduct.vendorCode) || wbProduct.barcodes.length > 0;

    unified.push(
      buildUnifiedItem(
        `wb-only-${wbProduct.nmID}`,
        wbProduct,
        null,
        hasIdentifier ? "wb_only" : "no_identifier",
        [],
        hasIdentifier
          ? ["Остаток WB указан на уровне nmID."]
          : ["Нет артикула и штрихкодов для сопоставления."],
      ),
    );
    usedWb.add(wbProduct.nmID);
  }

  for (const ozonProduct of ozonProducts) {
    if (usedOzon.has(ozonProduct.productId)) {
      continue;
    }

    const hasIdentifier =
      ozonProduct.offerId !== "—" || ozonProduct.barcodes.length > 0;

    unified.push(
      buildUnifiedItem(
        `ozon-only-${ozonProduct.productId}`,
        null,
        ozonProduct,
        hasIdentifier ? "ozon_only" : "no_identifier",
      ),
    );
    usedOzon.add(ozonProduct.productId);
  }

  const matchQuality = buildMatchQuality(unified);
  const identifierAudit = buildIdentifierAudit(
    wbProducts,
    ozonProducts,
    unified,
  );

  return { items: unified, matchQuality, identifierAudit };
}

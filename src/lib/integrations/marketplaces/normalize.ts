import "server-only";

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

export function normalizeOfferId(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const lower = value.trim().toLowerCase();
  if (!lower) {
    return null;
  }

  let normalized = "";

  for (const char of lower) {
    if (/[\s\-_]/.test(char)) {
      continue;
    }

    normalized += CYRILLIC_TO_LATIN[char] ?? char;
  }

  return normalized || null;
}

export function normalizeBarcode(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function intersectBarcodes(left: string[], right: string[]): string[] {
  const rightSet = new Set(right);
  return left.filter((barcode) => rightSet.has(barcode));
}

export function confidenceForMethod(
  method:
    | "barcode_exact"
    | "offer_exact"
    | "offer_normalized"
    | "ambiguous"
    | "wb_only"
    | "ozon_only"
    | "no_identifier",
): "high" | "medium" | "low" | "none" {
  switch (method) {
    case "barcode_exact":
      return "high";
    case "offer_exact":
      return "high";
    case "offer_normalized":
      return "medium";
    case "ambiguous":
      return "low";
    case "wb_only":
    case "ozon_only":
      return "none";
    case "no_identifier":
    default:
      return "none";
  }
}

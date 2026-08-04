import "server-only";

export const WB_API_HOSTS = {
  common: "https://common-api.wildberries.ru",
  content: "https://content-api.wildberries.ru",
  marketplace: "https://marketplace-api.wildberries.ru",
  statistics: "https://statistics-api.wildberries.ru",
  sellerAnalytics: "https://seller-analytics-api.wildberries.ru",
} as const;

export function getWbApiToken(): string | undefined {
  const token = process.env.WB_API_TOKEN?.trim();
  return token || undefined;
}

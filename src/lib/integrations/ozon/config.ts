import "server-only";

export const OZON_API_BASE = "https://api-seller.ozon.ru" as const;

export type OzonCredentials = {
  clientId: string;
  apiKey: string;
};

export function getOzonCredentials(): OzonCredentials | undefined {
  const clientId = process.env.OZON_CLIENT_ID?.trim();
  const apiKey = process.env.OZON_API_KEY?.trim();

  if (!clientId || !apiKey) {
    return undefined;
  }

  return { clientId, apiKey };
}

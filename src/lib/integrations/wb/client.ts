import "server-only";

import { safeFetch } from "@/lib/integrations/http";
import { WB_API_HOSTS } from "@/lib/integrations/wb/config";

export type WbRequestResult = {
  ok: boolean;
  status: number;
  data: unknown;
  durationMs: number;
  error?: string;
};

export class WbClient {
  constructor(private readonly token: string) {}

  private authHeaders(): HeadersInit {
    return {
      Authorization: this.token,
      Accept: "application/json",
    };
  }

  async getSellerInfo(): Promise<WbRequestResult> {
    return safeFetch(`${WB_API_HOSTS.common}/api/v1/seller-info`, {
      method: "GET",
      headers: this.authHeaders(),
    });
  }

  async getProductCards(limit = 20): Promise<WbRequestResult> {
    return this.getProductCardsPage(limit);
  }

  async getProductCardsPage(
    limit: number,
    cursor?: { updatedAt?: string; nmID?: number },
  ): Promise<WbRequestResult> {
    const cursorPayload: Record<string, unknown> = { limit };

    if (cursor?.updatedAt) {
      cursorPayload.updatedAt = cursor.updatedAt;
    }

    if (typeof cursor?.nmID === "number") {
      cursorPayload.nmID = cursor.nmID;
    }

    return safeFetch(`${WB_API_HOSTS.content}/content/v2/get/cards/list`, {
      method: "POST",
      headers: {
        ...this.authHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        settings: {
          cursor: cursorPayload,
          filter: {
            withPhoto: -1,
          },
        },
      }),
    });
  }

  async getProductCardsTrashPage(
    limit: number,
    cursor?: { trashedAt?: string; nmID?: number },
  ): Promise<WbRequestResult> {
    const cursorPayload: Record<string, unknown> = { limit };

    if (cursor?.trashedAt) {
      cursorPayload.trashedAt = cursor.trashedAt;
    }

    if (typeof cursor?.nmID === "number") {
      cursorPayload.nmID = cursor.nmID;
    }

    return safeFetch(`${WB_API_HOSTS.content}/content/v2/get/cards/trash`, {
      method: "POST",
      headers: {
        ...this.authHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        settings: {
          sort: {
            ascending: true,
          },
          cursor: cursorPayload,
        },
      }),
    });
  }

  async getWbWarehouseStocksReport(
    limit = 100,
    offset = 0,
  ): Promise<WbRequestResult> {
    return safeFetch(
      `${WB_API_HOSTS.sellerAnalytics}/api/analytics/v1/stocks-report/wb-warehouses`,
      {
        method: "POST",
        headers: {
          ...this.authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          limit,
          offset,
        }),
      },
    );
  }
}

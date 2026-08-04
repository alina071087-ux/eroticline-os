import "server-only";

import { safeFetch } from "@/lib/integrations/http";
import { OZON_API_BASE } from "@/lib/integrations/ozon/config";
import { OZON_FETCH_TIMEOUT_MS } from "@/lib/integrations/ozon/helpers";

export type OzonRequestResult = {
  ok: boolean;
  status: number;
  data: unknown;
  durationMs: number;
  error?: string;
};

export class OzonClient {
  constructor(
    private readonly clientId: string,
    private readonly apiKey: string,
  ) {}

  private authHeaders(): HeadersInit {
    return {
      "Client-Id": this.clientId,
      "Api-Key": this.apiKey,
      "Content-Type": "application/json",
    };
  }

  private post(path: string, body: unknown): Promise<OzonRequestResult> {
    return safeFetch(`${OZON_API_BASE}${path}`, {
      method: "POST",
      headers: this.authHeaders(),
      body: JSON.stringify(body),
      timeoutMs: OZON_FETCH_TIMEOUT_MS,
    });
  }

  async listWarehouses(limit = 200): Promise<OzonRequestResult> {
    return this.post("/v2/warehouse/list", { limit });
  }

  async getProductList(
    limit: number,
    lastId?: string,
  ): Promise<OzonRequestResult> {
    const body: Record<string, unknown> = {
      filter: { visibility: "ALL" },
      limit,
    };

    if (lastId) {
      body.last_id = lastId;
    }

    return this.post("/v3/product/list", body);
  }

  async getProductInfoList(productIds: number[]): Promise<OzonRequestResult> {
    return this.post("/v3/product/info/list", {
      product_id: productIds,
    });
  }

  async getProductInfoStocks(
    limit: number,
    cursor?: string,
  ): Promise<OzonRequestResult> {
    const body: Record<string, unknown> = {
      filter: { visibility: "ALL" },
      limit,
    };

    if (cursor) {
      body.cursor = cursor;
    }

    return this.post("/v4/product/info/stocks", body);
  }
}

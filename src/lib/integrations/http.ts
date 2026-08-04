import "server-only";

export type SafeFetchResult = {
  ok: boolean;
  status: number;
  data: unknown;
  durationMs: number;
  error?: string;
};

const DEFAULT_TIMEOUT_MS = 15_000;

export async function safeFetch(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<SafeFetchResult> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options;
  const startedAt = Date.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });

    const durationMs = Date.now() - startedAt;
    const contentType = response.headers.get("content-type") ?? "";
    let data: unknown = null;

    if (contentType.includes("application/json")) {
      try {
        data = await response.json();
      } catch {
        data = null;
      }
    } else {
      const text = await response.text();
      data = text.length > 0 ? { raw: text.slice(0, 500) } : null;
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    if (error instanceof Error && error.name === "AbortError") {
      return {
        ok: false,
        status: 0,
        data: null,
        durationMs,
        error: "TIMEOUT",
      };
    }

    return {
      ok: false,
      status: 0,
      data: null,
      durationMs,
      error: "NETWORK_ERROR",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

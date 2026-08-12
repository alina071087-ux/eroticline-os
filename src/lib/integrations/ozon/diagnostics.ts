import "server-only";

export type OzonRequestDiagnostic = {
  endpoint: string;
  method: "POST";
  httpStatus: number;
  errorCode?: string | number;
  errorMessage?: string;
  requestBodyPreview: Record<string, unknown>;
  durationMs: number;
};

export function extractOzonErrorDetails(data: unknown): {
  errorCode?: string | number;
  errorMessage?: string;
} {
  if (!data || typeof data !== "object") {
    return {};
  }

  const record = data as Record<string, unknown>;
  const details: { errorCode?: string | number; errorMessage?: string } = {};

  if (typeof record.code === "number" || typeof record.code === "string") {
    details.errorCode = record.code;
  }

  if (typeof record.message === "string" && record.message.trim()) {
    details.errorMessage = record.message.trim().slice(0, 500);
  }

  return details;
}

export function buildOzonRequestDiagnostic(input: {
  endpoint: string;
  httpStatus: number;
  durationMs: number;
  requestBody: Record<string, unknown>;
  responseData?: unknown;
}): OzonRequestDiagnostic {
  const { errorCode, errorMessage } = extractOzonErrorDetails(input.responseData);

  return {
    endpoint: input.endpoint,
    method: "POST",
    httpStatus: input.httpStatus,
    errorCode,
    errorMessage,
    requestBodyPreview: sanitizeRequestBodyPreview(input.requestBody),
    durationMs: input.durationMs,
  };
}

function sanitizeRequestBodyPreview(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const preview: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(body)) {
    if (key === "product_id" && Array.isArray(value)) {
      preview.product_id_count = value.length;
      if (value.length > 0) {
        preview.product_id_sample = value.slice(0, 3);
      }
      continue;
    }

    preview[key] = value;
  }

  return preview;
}

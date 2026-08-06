import { auditOneCSkuFile } from "@/lib/integrations/1c/audit";
import type { OneCSkuAuditResult } from "@/lib/integrations/1c/types";
import { unlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const ALLOWED_EXTENSION = ".xlsx";

function sanitizeFileName(fileName: string): string {
  const baseName = fileName.split(/[/\\]/).pop() ?? "upload.xlsx";
  return baseName.replace(/[^\w.\-() \u0400-\u04FF]/g, "_").slice(0, 120);
}

function httpStatusForResult(status: OneCSkuAuditResult["status"]): number {
  switch (status) {
    case "ok":
    case "partial":
      return 200;
    case "error":
    default:
      return 422;
  }
}

export async function POST(request: Request) {
  let tempPath: string | null = null;

  try {
    const formData = await request.formData();
    const fileValue = formData.get("file");

    if (!(fileValue instanceof File)) {
      return Response.json(
        {
          source: "1c",
          status: "error",
          fileName: "",
          fetchedAt: new Date().toISOString(),
          durationMs: 0,
          message: "Файл не передан",
          error: {
            code: "MISSING_FILE",
            message: "Выберите Excel-файл (.xlsx) для проверки.",
          },
        } satisfies OneCSkuAuditResult,
        { status: 400 },
      );
    }

    const safeName = sanitizeFileName(fileValue.name || "upload.xlsx");
    const lowerName = safeName.toLowerCase();

    if (!lowerName.endsWith(ALLOWED_EXTENSION)) {
      return Response.json(
        {
          source: "1c",
          status: "error",
          fileName: safeName,
          fetchedAt: new Date().toISOString(),
          durationMs: 0,
          message: "Неверный формат файла",
          error: {
            code: "INVALID_EXTENSION",
            message: "Поддерживается только формат .xlsx.",
          },
        } satisfies OneCSkuAuditResult,
        { status: 400 },
      );
    }

    if (fileValue.size > MAX_FILE_SIZE_BYTES) {
      return Response.json(
        {
          source: "1c",
          status: "error",
          fileName: safeName,
          fetchedAt: new Date().toISOString(),
          durationMs: 0,
          message: "Файл слишком большой",
          error: {
            code: "FILE_TOO_LARGE",
            message: "Максимальный размер файла — 20 МБ.",
          },
        } satisfies OneCSkuAuditResult,
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await fileValue.arrayBuffer());
    tempPath = join(tmpdir(), `1c-sku-audit-${randomUUID()}${ALLOWED_EXTENSION}`);
    await writeFile(tempPath, buffer);

    const result = await auditOneCSkuFile(buffer, safeName);

    return Response.json(result, {
      status: httpStatusForResult(result.status),
    });
  } catch {
    return Response.json(
      {
        source: "1c",
        status: "error",
        fileName: "",
        fetchedAt: new Date().toISOString(),
        durationMs: 0,
        message: "Не удалось обработать файл",
        error: {
          code: "INTERNAL_ERROR",
          message: "Не удалось обработать файл. Попробуйте ещё раз.",
        },
      } satisfies OneCSkuAuditResult,
      { status: 500 },
    );
  } finally {
    if (tempPath) {
      await unlink(tempPath).catch(() => undefined);
    }
  }
}

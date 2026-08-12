import "server-only";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const ALLOWED_EXTENSION = ".xlsx";

export function sanitizeExcelFileName(fileName: string): string {
  const baseName = fileName.split(/[/\\]/).pop() ?? "upload.xlsx";
  return baseName.replace(/[^\w.\-() \u0400-\u04FF]/g, "_").slice(0, 120);
}

export type ParsedExcelUpload =
  | {
      ok: true;
      buffer: Buffer;
      fileName: string;
    }
  | {
      ok: false;
      status: number;
      message: string;
      code: string;
      fileName?: string;
    };

export async function parseExcelUpload(
  request: Request,
): Promise<ParsedExcelUpload> {
  const formData = await request.formData();
  const fileValue = formData.get("file");

  if (!(fileValue instanceof File)) {
    return {
      ok: false,
      status: 400,
      code: "MISSING_FILE",
      message: "Выберите Excel-файл (.xlsx) для проверки.",
    };
  }

  const fileName = sanitizeExcelFileName(fileValue.name || "upload.xlsx");
  const lowerName = fileName.toLowerCase();

  if (!lowerName.endsWith(ALLOWED_EXTENSION)) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_EXTENSION",
      message: "Поддерживается только формат .xlsx.",
      fileName,
    };
  }

  if (fileValue.size > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      status: 413,
      code: "FILE_TOO_LARGE",
      message: "Максимальный размер файла — 20 МБ.",
      fileName,
    };
  }

  const buffer = Buffer.from(await fileValue.arrayBuffer());

  return {
    ok: true,
    buffer,
    fileName,
  };
}

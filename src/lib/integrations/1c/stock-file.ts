import "server-only";

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const DEFAULT_STOCK_FILE_NAME = "1c-stocks-2026-08-18.xlsx";

export function getDefaultStockFilePath(): string {
  return path.join(process.cwd(), "tmp", DEFAULT_STOCK_FILE_NAME);
}

export function readDefaultStockFile(): {
  buffer: Buffer;
  fileName: string;
  filePath: string;
} {
  const filePath = getDefaultStockFilePath();
  const fileName = path.basename(filePath);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Stock file not found: ${filePath}`);
  }

  return {
    buffer: fs.readFileSync(filePath),
    fileName,
    filePath,
  };
}

export function hashStockFile(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

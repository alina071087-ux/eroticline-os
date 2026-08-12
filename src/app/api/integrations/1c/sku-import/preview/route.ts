import { previewOneCSkuImport } from "@/lib/integrations/1c/import-preview";
import { parseExcelUpload } from "@/lib/integrations/1c/upload";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const upload = await parseExcelUpload(request);

  if (!upload.ok) {
    return Response.json(
      {
        source: "1c",
        status: "error",
        importPreviewId: "",
        fileName: upload.fileName ?? "",
        fetchedAt: new Date().toISOString(),
        durationMs: 0,
        message: upload.message,
        error: {
          code: upload.code,
          message: upload.message,
        },
      },
      { status: upload.status },
    );
  }

  const result = await previewOneCSkuImport(upload.buffer, upload.fileName);

  return Response.json(result, {
    status: result.status === "error" ? 422 : 200,
  });
}

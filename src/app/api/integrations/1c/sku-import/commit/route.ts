import { commitOneCSkuImport } from "@/lib/integrations/1c/import-commit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CommitBody = {
  importPreviewId?: unknown;
};

export async function POST(request: Request) {
  let body: CommitBody;

  try {
    body = (await request.json()) as CommitBody;
  } catch {
    return Response.json(
      {
        source: "1c",
        status: "error",
        importId: "",
        importPreviewId: "",
        fetchedAt: new Date().toISOString(),
        durationMs: 0,
        message: "Некорректный JSON",
        addedCount: 0,
        updatedCount: 0,
        unchangedCount: 0,
        errorCount: 0,
        error: {
          code: "VALIDATION_ERROR",
          message: "Некорректный JSON",
        },
      },
      { status: 400 },
    );
  }

  const importPreviewId =
    typeof body.importPreviewId === "string" ? body.importPreviewId.trim() : "";

  const result = await commitOneCSkuImport(importPreviewId);

  const status =
    result.status === "ok"
      ? 200
      : result.error?.code === "ALREADY_COMMITTED"
        ? 409
        : result.error?.code === "NOT_FOUND"
          ? 404
          : 422;

  return Response.json(result, { status });
}

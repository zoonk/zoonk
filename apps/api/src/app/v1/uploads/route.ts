import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { createUploadRequestSchema } from "@/lib/openapi/schemas/research-sources";
import { readBody } from "@/lib/request-input";
import { toSourceResource } from "@/lib/source-resources";
import { isRefusedUsage } from "@zoonk/core/entitlements/contract";
import { registerSourceUpload } from "@zoonk/core/library/sources/register-upload";
import { type NextRequest, NextResponse } from "next/server";

async function createUpload(request: NextRequest) {
  const parsed = await readBody(request, createUploadRequestSchema);

  const result = await registerSourceUpload(parsed);

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "invalidPathname") {
    return errors.badRequest("Uploads go in your own folder: sources/{userId}/");
  }

  if (result.status === "notFound") {
    return errors.notFound("Upload not found");
  }

  if (result.status === "unsupported") {
    return errors.unprocessableEntity(
      "This file can't be read. Try a PDF, image, Word, PowerPoint, text or Markdown file.",
    );
  }

  if (isRefusedUsage(result)) {
    return usageDecisionError(result);
  }

  return NextResponse.json(
    { checkingVisibility: result.checkVisibility, source: toSourceResource(result.source) },
    { status: 201 },
  );
}

export const POST = withApiErrorBoundary(createUpload);

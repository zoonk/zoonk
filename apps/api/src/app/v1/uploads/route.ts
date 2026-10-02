import { createErrorResponse, errors, httpStatus, slowDownError } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { createUploadRequestSchema } from "@/lib/openapi/schemas/research-sources";
import { toSourceResource } from "@/lib/source-resources";
import { sourceVisibilityWorkflow } from "@/workflows/v2/research/source-visibility-workflow";
import { registerSourceUpload } from "@zoonk/core/library/sources/register-upload";
import { type NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";

/**
 * Registers a file the learner uploaded to their Blob folder, or text they
 * pasted, as a source. A new document is private until the visibility check
 * (started here) confirms its publisher made it public; a document already
 * shared, such as a known exam notice, is linked at once.
 */
async function createUpload(request: NextRequest) {
  const parsed = await parseBody(request, createUploadRequestSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const result = await registerSourceUpload(parsed.data);

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

  if (result.status === "limitReached") {
    return createErrorResponse({
      code: "UPLOAD_LIMIT_REACHED",
      message: "Upload limit reached",
      status: httpStatus.tooManyRequests,
    });
  }

  if (result.status === "slowDown") {
    return slowDownError({
      details: result,
      message: "Too many uploads at once",
      retryAfterSeconds: result.retryAfterSeconds,
    });
  }

  const { checkVisibility, source } = result;

  if (checkVisibility && source.ownerId) {
    await start(sourceVisibilityWorkflow, [{ ownerId: source.ownerId, sourceId: source.id }]);
  }

  return NextResponse.json(
    { checkingVisibility: checkVisibility, source: toSourceResource(source) },
    { status: 201 },
  );
}

export const POST = withApiErrorBoundary(createUpload);

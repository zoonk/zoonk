import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { uploadTokenRequestSchema } from "@/lib/openapi/schemas/research-sources";
import { handleUploadPresigned } from "@vercel/blob/client";
import { createSourceUploadToken } from "@zoonk/core/library/sources/upload-token";
import { type NextRequest, NextResponse } from "next/server";

/**
 * `handleUploadPresigned` requires a key for verifying upload-completed callbacks before it signs
 * anything, even when no callback is asked for. This route never asks for one (the schema refuses
 * callbacks; the client registers the file with `POST /v1/uploads`), so no key is ever used.
 */
const NO_CALLBACK_KEY = "unused: uploads are registered with POST /v1/uploads";

/**
 * The route Vercel Blob's client `uploadPresigned()` calls before sending a file straight to the
 * private store, since function requests are capped at 4.5 MB. It speaks Blob's presigned-upload
 * protocol for URL requests only: completed uploads are registered with `POST /v1/uploads` instead
 * of a storage callback, which also works where callbacks can't reach.
 */
async function createUploadToken(request: NextRequest) {
  const parsed = await parseBody(request, uploadTokenRequestSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const result = await createSourceUploadToken({ pathname: parsed.data.payload.pathname });

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "invalidPathname") {
    return errors.badRequest("Uploads go in your own folder: sources/{userId}/");
  }

  if (result.status === "limitReached") {
    return usageDecisionError(result);
  }

  const presigned = await handleUploadPresigned({
    body: parsed.data,
    getSignedToken: async () => ({ token: result.token, urlOptions: result.urlOptions }),
    request,
    webhookPublicKey: NO_CALLBACK_KEY,
  });

  return NextResponse.json(presigned);
}

export const POST = withApiErrorBoundary(createUploadToken);

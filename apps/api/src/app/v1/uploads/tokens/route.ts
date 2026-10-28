import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { uploadTokenRequestSchema } from "@/lib/openapi/schemas/research-sources";
import { readBody } from "@/lib/request-input";
import { handleUploadPresigned } from "@vercel/blob/client";
import { isRefusedUsage } from "@zoonk/core/entitlements/contract";
import { createSourceUploadToken } from "@zoonk/core/library/sources/upload-token";
import { type NextRequest, NextResponse } from "next/server";

/** `handleUploadPresigned` requires a callback key even when no callback is asked for. */
const NO_CALLBACK_KEY = "unused: uploads are registered with POST /v1/uploads";

/**
 * Files go straight to Blob because function requests are capped at 4.5 MB. Completed uploads are
 * registered with `POST /v1/uploads`, not a storage callback, which can't reach every environment.
 */
async function createUploadToken(request: NextRequest) {
  const parsed = await readBody(request, uploadTokenRequestSchema);

  const result = await createSourceUploadToken({ pathname: parsed.payload.pathname });

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "invalidPathname") {
    return errors.badRequest("Uploads go in your own folder: sources/{userId}/");
  }

  if (isRefusedUsage(result)) {
    return usageDecisionError(result);
  }

  const presigned = await handleUploadPresigned({
    body: parsed,
    getSignedToken: async () => ({ token: result.token, urlOptions: result.urlOptions }),
    request,
    webhookPublicKey: NO_CALLBACK_KEY,
  });

  return NextResponse.json(presigned);
}

export const POST = withApiErrorBoundary(createUploadToken);

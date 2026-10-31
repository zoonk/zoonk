import { createErrorResponse, httpStatus } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { authRateLimitError } from "@/lib/auth-rate-limit-error";
import { readBody } from "@/lib/request-input";
import { sessionErrorCodes } from "@/lib/session-error-codes";
import { createAppAttestKey } from "@zoonk/auth/app-attest";
import { appAttestKeyRequestSchema } from "@zoonk/auth/app-attest-contract";
import { getAuthError } from "@zoonk/auth/errors";
import { safeAsync } from "@zoonk/utils/error";
import { type NextRequest } from "next/server";

function getKeyErrorResponse(error: unknown) {
  if (getAuthError(error)?.code === sessionErrorCodes.appAttestationInvalid) {
    return createErrorResponse({
      code: sessionErrorCodes.appAttestationInvalid,
      message: "This app attestation is invalid or its challenge expired",
      status: httpStatus.badRequest,
    });
  }

  return authRateLimitError(error);
}

async function createKey(request: NextRequest) {
  const body = await readBody(request, appAttestKeyRequestSchema);

  const { error } = await safeAsync(() =>
    createAppAttestKey({ ...body, headers: request.headers, requestURL: request.url }),
  );

  if (error) {
    const response = getKeyErrorResponse(error);

    if (response) {
      return response;
    }

    throw error;
  }

  return new Response(null, { status: 204 });
}

export const POST = withApiErrorBoundary(createKey);

import { accessErrorCodes } from "@/lib/access-error-codes";
import { createErrorResponse, httpStatus } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { authRateLimitError } from "@/lib/auth-rate-limit-error";
import { getAuthError } from "@zoonk/auth/errors";
import { createGuestSession } from "@zoonk/auth/native-sessions";
import { safeAsync } from "@zoonk/utils/error";
import { type NextRequest, NextResponse } from "next/server";

function getGuestErrorResponse(error: unknown) {
  const code = getAuthError(error)?.code;

  if (code === accessErrorCodes.botDetected) {
    return createErrorResponse({
      code,
      message: "This request looks automated",
      status: httpStatus.forbidden,
    });
  }

  if (code === "ANONYMOUS_USERS_CANNOT_SIGN_IN_AGAIN_ANONYMOUSLY") {
    return createErrorResponse({
      code: accessErrorCodes.alreadyGuest,
      message: "This session is already a guest",
      status: httpStatus.conflict,
    });
  }

  return authRateLimitError(error);
}

async function createGuest(request: NextRequest) {
  const { data, error } = await safeAsync(() =>
    createGuestSession({ headers: request.headers, requestURL: request.url }),
  );

  if (error) {
    const response = getGuestErrorResponse(error);

    if (response) {
      return response;
    }

    throw error;
  }

  return NextResponse.json(data, { status: 201 });
}

export const POST = withApiErrorBoundary(createGuest);

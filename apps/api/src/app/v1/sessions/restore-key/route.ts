import { withApiErrorBoundary } from "@/lib/api-handler";
import { restoreKeySessionRequestBodySchema } from "@/lib/openapi/schemas/sessions";
import { readBody } from "@/lib/request-input";
import { createRestoreKeySession } from "@zoonk/auth/native-sessions";
import { safeAsync } from "@zoonk/utils/error";
import { type NextRequest, NextResponse } from "next/server";
import { getRestoreKeySessionErrorResponse } from "../_utils/session-errors";

async function createRestoreKeySessionRoute(request: NextRequest) {
  const { authenticationResponseJson } = await readBody(
    request,
    restoreKeySessionRequestBodySchema,
  );

  const { data: session, error } = await safeAsync(() =>
    createRestoreKeySession({
      authenticationResponseJson,
      headers: request.headers,
      requestURL: request.url,
    }),
  );

  if (error) {
    const errorResponse = getRestoreKeySessionErrorResponse(error);

    if (errorResponse) {
      return errorResponse;
    }

    throw error;
  }

  return NextResponse.json(session);
}

export const POST = withApiErrorBoundary(createRestoreKeySessionRoute);

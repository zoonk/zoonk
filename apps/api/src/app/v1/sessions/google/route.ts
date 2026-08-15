import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { googleSessionRequestSchema } from "@/lib/openapi/schemas/sessions";
import { createGoogleSession } from "@zoonk/auth/native-sessions";
import { safeAsync } from "@zoonk/utils/error";
import { type NextRequest, NextResponse } from "next/server";
import { getGoogleSessionErrorResponse } from "../_utils/session-errors";

async function createGoogleSessionRoute(request: NextRequest) {
  const parsed = await parseBody(request, googleSessionRequestSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const { data: session, error } = await safeAsync(() =>
    createGoogleSession({ ...parsed.data, headers: request.headers, requestURL: request.url }),
  );

  if (error) {
    const errorResponse = getGoogleSessionErrorResponse(error);

    if (errorResponse) {
      return errorResponse;
    }

    throw error;
  }

  return NextResponse.json(session);
}

export const POST = withApiErrorBoundary(createGoogleSessionRoute);

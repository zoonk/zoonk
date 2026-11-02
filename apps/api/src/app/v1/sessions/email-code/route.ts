import { withApiErrorBoundary } from "@/lib/api-handler";
import { emailCodeSessionRequestSchema } from "@/lib/openapi/schemas/sessions";
import { readBody } from "@/lib/request-input";
import { createEmailCodeSession } from "@zoonk/auth/native-sessions";
import { safeAsync } from "@zoonk/utils/error";
import { type NextRequest, NextResponse } from "next/server";
import { getEmailSessionErrorResponse } from "../_utils/session-errors";

async function createEmailCodeSessionRoute(request: NextRequest) {
  const parsed = await readBody(request, emailCodeSessionRequestSchema);

  const { data: session, error } = await safeAsync(() =>
    createEmailCodeSession({ ...parsed, headers: request.headers, requestURL: request.url }),
  );

  if (error) {
    const errorResponse = getEmailSessionErrorResponse(error);

    if (errorResponse) {
      return errorResponse;
    }

    throw error;
  }

  return NextResponse.json(session);
}

export const POST = withApiErrorBoundary(createEmailCodeSessionRoute);

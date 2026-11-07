import { withApiErrorBoundary } from "@/lib/api-handler";
import { restoreKeyRequestBodySchema } from "@/lib/openapi/schemas/sessions";
import { readBody } from "@/lib/request-input";
import { createRestoreKey } from "@zoonk/auth/native-sessions";
import { safeAsync } from "@zoonk/utils/error";
import { type NextRequest } from "next/server";
import { getRestoreKeyErrorResponse } from "../../_utils/session-errors";

async function createRestoreKeyRoute(request: NextRequest) {
  const { registrationResponseJson } = await readBody(request, restoreKeyRequestBodySchema);

  const { error } = await safeAsync(() =>
    createRestoreKey({
      headers: request.headers,
      registrationResponseJson,
      requestURL: request.url,
    }),
  );

  if (error) {
    const errorResponse = getRestoreKeyErrorResponse(error);

    if (errorResponse) {
      return errorResponse;
    }

    throw error;
  }

  return new Response(null, { status: 204 });
}

export const POST = withApiErrorBoundary(createRestoreKeyRoute);

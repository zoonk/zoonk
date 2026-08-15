import { getEmailSessionErrorResponse } from "@/app/v1/sessions/_utils/session-errors";
import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { emailSignInCodeRequestSchema } from "@/lib/openapi/schemas/sessions";
import { createEmailSignInCode } from "@zoonk/auth/native-sessions";
import { safeAsync } from "@zoonk/utils/error";
import { type NextRequest } from "next/server";

async function createEmailSignInCodeRoute(request: NextRequest) {
  const parsed = await parseBody(request, emailSignInCodeRequestSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const { error } = await safeAsync(() =>
    createEmailSignInCode({
      email: parsed.data.email,
      headers: request.headers,
      requestURL: request.url,
    }),
  );

  if (error) {
    const errorResponse = getEmailSessionErrorResponse(error);

    if (errorResponse) {
      return errorResponse;
    }

    throw error;
  }

  return new Response(null, { status: 204 });
}

export const POST = withApiErrorBoundary(createEmailSignInCodeRoute);

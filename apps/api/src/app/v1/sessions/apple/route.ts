import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { signInWithNativeApple } from "@zoonk/auth/native-apple";
import { nativeAppleCredentialsSchema } from "@zoonk/auth/native-apple-contract";
import { safeAsync } from "@zoonk/utils/error";
import { type NextRequest, NextResponse } from "next/server";
import { getAppleSessionErrorResponse } from "../_utils/session-errors";

async function createAppleSession(request: NextRequest) {
  const parsed = await parseBody(request, nativeAppleCredentialsSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const { data: session, error } = await safeAsync(() =>
    signInWithNativeApple({
      credentials: parsed.data,
      headers: request.headers,
      requestURL: request.url,
    }),
  );

  if (error) {
    const errorResponse = getAppleSessionErrorResponse(error);

    if (errorResponse) {
      return errorResponse;
    }

    throw error;
  }

  return NextResponse.json({ token: session.token });
}

export const POST = withApiErrorBoundary(createAppleSession);

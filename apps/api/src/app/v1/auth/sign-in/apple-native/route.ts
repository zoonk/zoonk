import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import {
  AppleAuthorizationError,
  NativeAppleAccountError,
  signInWithNativeApple,
} from "@zoonk/auth/native-apple";
import { nativeAppleCredentialsSchema } from "@zoonk/auth/native-apple-contract";
import { safeAsync } from "@zoonk/utils/error";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Maps provider credentials to a Zoonk bearer session while keeping Apple's
 * single-use authorization-code exchange and account ownership checks on the
 * server.
 */
async function signInWithNativeAppleRoute(request: NextRequest) {
  const parsed = await parseBody(request, nativeAppleCredentialsSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const { data: session, error } = await safeAsync(() => signInWithNativeApple(parsed.data));

  if (error instanceof NativeAppleAccountError) {
    return errors.unauthorized("Apple authorization does not match this account");
  }

  if (error instanceof AppleAuthorizationError && error.reason === "invalidCredential") {
    return errors.unauthorized("Apple authorization is invalid or expired");
  }

  if (error) {
    throw error;
  }

  return NextResponse.json({ token: session.token });
}

export const POST = withApiErrorBoundary(signInWithNativeAppleRoute);

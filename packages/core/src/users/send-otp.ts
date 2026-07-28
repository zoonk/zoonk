import "server-only";
import { auth } from "@zoonk/auth";

/**
 * Sends the sign-in OTP through Better Auth and returns its delivery result.
 *
 * Better Auth needs request headers when resolving a dynamic base URL.
 * Accepting the current request headers here keeps login actions aligned with
 * the real incoming host instead of relying on the auth fallback. Callers keep
 * the `success` response so they do not advance to the OTP screen if Better
 * Auth accepts the request shape but reports that it did not send the code.
 */
export async function sendVerificationOTP({
  email,
  headers,
}: {
  email: string;
  headers?: Headers;
}) {
  return auth.api.sendVerificationOTP({ body: { email, type: "sign-in" }, headers });
}

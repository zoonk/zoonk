import "server-only";
import { auth } from "@zoonk/auth";

/**
 * Send the sign-in OTP through Better Auth.
 *
 * Better Auth now needs request headers when resolving a dynamic base URL.
 * Accepting the current request headers here keeps login actions aligned with
 * the real incoming host instead of relying on the auth fallback.
 */
export async function sendVerificationOTP({
  email,
  headers,
}: {
  email: string;
  headers?: Headers;
}) {
  const data = await auth.api.sendVerificationOTP({
    body: { email, type: "sign-in" },
    headers,
  });

  return { data };
}

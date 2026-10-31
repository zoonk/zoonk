import "server-only";
import { auth } from "@zoonk/auth";
import { isHumanRequest } from "@zoonk/auth/human-check";

/** Web sign-up requires BotID and incoming headers for Better Auth's dynamic host; advance only when success confirms delivery. */
export async function sendVerificationOTP({
  email,
  headers,
}: {
  email: string;
  headers?: Headers;
}) {
  if (!(await isHumanRequest())) {
    return { success: false };
  }

  return auth.api.sendVerificationOTP({ body: { email, type: "sign-in" }, headers });
}

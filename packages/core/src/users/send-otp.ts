import "server-only";
import { auth } from "@zoonk/auth";

export async function sendVerificationOTP(email: string) {
  const data = await auth.api.sendVerificationOTP({
    body: { email, type: "sign-in" },
  });

  return { data };
}

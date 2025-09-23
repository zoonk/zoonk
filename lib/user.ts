import { headers } from "next/headers";
import { auth } from "./auth";

export async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return session;
}

export async function sendVerificationOTP(email: string) {
  const data = await auth.api.sendVerificationOTP({
    body: { email, type: "sign-in" },
  });

  return { data };
}

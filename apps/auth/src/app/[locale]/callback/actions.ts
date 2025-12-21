"use server";

import { auth } from "@zoonk/auth";
import { headers } from "next/headers";

export async function createOneTimeTokenAction(
  redirectTo: string,
): Promise<string> {
  const headersList = await headers();

  const response = await auth.api.generateOneTimeToken({
    headers: headersList,
  });

  if (!response?.token) {
    throw new Error("Failed to generate one-time token");
  }

  // Build the redirect URL with the token
  const redirectUrl = new URL(redirectTo);
  redirectUrl.searchParams.set("token", response.token);

  return redirectUrl.toString();
}

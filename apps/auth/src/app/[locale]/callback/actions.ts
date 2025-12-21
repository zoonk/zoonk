"use server";

import { authWithOTT } from "@zoonk/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function createOneTimeTokenAction(redirectTo: string) {
  const headersList = await headers();

  const response = await authWithOTT.api.generateOneTimeToken({
    headers: headersList,
  });

  if (!response?.token) {
    throw new Error("Failed to generate one-time token");
  }

  // Build the redirect URL with the token
  const redirectUrl = new URL(redirectTo);
  redirectUrl.searchParams.set("token", response.token);

  // Use type assertion for external URL redirect
  redirect(redirectUrl.toString() as Parameters<typeof redirect>[0]);
}

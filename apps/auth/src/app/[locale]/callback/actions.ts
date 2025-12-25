"use server";

import { auth } from "@zoonk/core/auth";
import { safeAsync } from "@zoonk/utils/error";
import { headers } from "next/headers";

export async function createOneTimeTokenAction(
  redirectTo: string,
): Promise<string> {
  const { data, error } = await safeAsync(
    async () =>
      await auth.api.generateOneTimeToken({
        headers: await headers(),
      }),
  );

  if (error) {
    console.error("Error generating one-time token:", error);
  }

  const redirectUrl = new URL(redirectTo);
  redirectUrl.searchParams.set("token", data?.token ?? "");

  return redirectUrl.toString();
}

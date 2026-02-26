"use server";

import { auth } from "@zoonk/core/auth";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { headers } from "next/headers";

export async function profileFormAction(_prevState: unknown, formData: FormData) {
  const name = parseFormField(formData, "name");
  const username = parseFormField(formData, "username");

  if (!name || !username) {
    return { name: name ?? "", status: "error" as const, username: username ?? "" };
  }

  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  const usernameChanged = session?.user.username !== username;

  const body: { name: string; username?: string } = { name };

  if (usernameChanged) {
    body.username = username;
  }

  const { error } = await safeAsync(async () =>
    auth.api.updateUser({
      body,
      headers: reqHeaders,
    }),
  );

  if (error) {
    console.error("Error updating profile:", error);
    return { name, status: "error" as const, username };
  }

  return { name, status: "success" as const, username };
}

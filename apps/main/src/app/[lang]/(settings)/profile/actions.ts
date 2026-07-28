"use server";

import { updateCurrentUser } from "@zoonk/core/users/current";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { logError } from "@zoonk/utils/logger";

export async function profileFormAction(_prevState: unknown, formData: FormData) {
  const name = parseFormField(formData, "name");
  const username = parseFormField(formData, "username");

  if (!name || !username) {
    return { name: name ?? "", status: "error" as const, username: username ?? "" };
  }

  const { data: result, error } = await safeAsync(() =>
    updateCurrentUser({ input: { name, username } }),
  );

  if (error || !result) {
    logError("Error updating profile:", error);
    return { name, status: "error" as const, username };
  }

  return { name, status: "success" as const, username };
}

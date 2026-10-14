"use server";

import { getAuthError } from "@zoonk/auth/errors";
import { updateCurrentUser } from "@zoonk/core/users/current";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { logError } from "@zoonk/utils/logger";

type ProfileFormStatus = "error" | "idle" | "success" | "usernameTaken";

/** Saves the learner's name and username; a username taken meanwhile says so. */
export async function profileFormAction(_prevState: unknown, formData: FormData) {
  const name = parseFormField(formData, "name");
  const username = parseFormField(formData, "username");

  if (!name || !username) {
    return { name: name ?? "", status: "error" as ProfileFormStatus, username: username ?? "" };
  }

  const { data: result, error } = await safeAsync(() =>
    updateCurrentUser({ input: { name, username } }),
  );

  if (getAuthError(error)?.code === "USERNAME_IS_ALREADY_TAKEN") {
    return { name, status: "usernameTaken" as ProfileFormStatus, username };
  }

  if (error || !result) {
    logError("Error updating profile:", error);
    return { name, status: "error" as ProfileFormStatus, username };
  }

  return { name, status: "success" as ProfileFormStatus, username };
}

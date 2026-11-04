"use server";

import { getAuthError } from "@zoonk/auth/errors";
import { NAME_TOO_LONG_ERROR_CODE } from "@zoonk/auth/name-rules";
import { updateCurrentUser } from "@zoonk/core/users/current";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { logError } from "@zoonk/utils/logger";

type ProfileFormStatus = "error" | "idle" | "nameTooLong" | "success" | "usernameTaken";

export async function profileFormAction(_prevState: unknown, formData: FormData) {
  const name = parseFormField(formData, "name");
  const username = parseFormField(formData, "username");

  if (!name || !username) {
    return { status: "error" as ProfileFormStatus, username: username ?? "" };
  }

  const { data: result, error } = await safeAsync(() =>
    updateCurrentUser({ input: { name, username } }),
  );

  const errorCode = getAuthError(error)?.code;

  if (errorCode === NAME_TOO_LONG_ERROR_CODE) {
    return { status: "nameTooLong" as ProfileFormStatus, username };
  }

  if (errorCode === "USERNAME_IS_ALREADY_TAKEN") {
    return { status: "usernameTaken" as ProfileFormStatus, username };
  }

  if (error || !result) {
    logError("Error updating profile:", error);
    return { status: "error" as ProfileFormStatus, username };
  }

  return { status: "success" as ProfileFormStatus, username };
}

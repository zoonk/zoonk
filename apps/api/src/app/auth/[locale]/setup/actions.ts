"use server";

import { getAuthError } from "@zoonk/auth/errors";
import { NAME_TOO_LONG_ERROR_CODE } from "@zoonk/auth/name-rules";
import { isUsernameSyntaxValid } from "@zoonk/auth/username-rules";
import { updateCurrentUser } from "@zoonk/core/users/current";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { logError } from "@zoonk/utils/logger";
import { redirect } from "next/navigation";
import { getCallbackHref } from "../../_utils/auth-redirect";

export type SetupState = { status: "error" | "idle" | "nameTooLong" | "usernameTaken" };

export async function setupProfileAction(
  redirectTo: string | null,
  _prevState: SetupState,
  formData: FormData,
): Promise<SetupState> {
  const name = parseFormField(formData, "name");
  const username = parseFormField(formData, "username");

  if (!name || !username || !isUsernameSyntaxValid(username)) {
    return { status: "error" };
  }

  const { data, error } = await safeAsync(() => updateCurrentUser({ input: { name, username } }));
  const errorCode = getAuthError(error)?.code;

  if (errorCode === NAME_TOO_LONG_ERROR_CODE) {
    return { status: "nameTooLong" };
  }

  if (errorCode === "USERNAME_IS_ALREADY_TAKEN") {
    return { status: "usernameTaken" };
  }

  if (error || !data) {
    logError("Error setting up profile:", error);
    return { status: "error" };
  }

  redirect(getCallbackHref(redirectTo));
}

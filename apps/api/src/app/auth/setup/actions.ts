"use server";

import { getAuthError } from "@zoonk/auth/errors";
import { isUsernameSyntaxValid } from "@zoonk/auth/username-rules";
import { updateCurrentUser } from "@zoonk/core/users/current";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { logError } from "@zoonk/utils/logger";
import { redirect } from "next/navigation";
import { getCallbackHref } from "../_utils/auth-redirect";

type SetupState = { status: "error" | "idle" | "usernameTaken" };

/** Someone took the username between its availability check and the save. */
function isUsernameTaken(error: unknown): boolean {
  return getAuthError(error)?.code === "USERNAME_IS_ALREADY_TAKEN";
}

/** Saves the new account's name and username, then goes on to where the learner was going. */
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

  if (isUsernameTaken(error)) {
    return { status: "usernameTaken" };
  }

  if (error || !data) {
    logError("Error setting up profile:", error);
    return { status: "error" };
  }

  redirect(getCallbackHref(redirectTo));
}

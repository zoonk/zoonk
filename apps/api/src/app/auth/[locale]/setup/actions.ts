"use server";

import { getAuthError } from "@zoonk/auth/errors";
import { NAME_TOO_LONG_ERROR_CODE } from "@zoonk/auth/name-rules";
import { suggestCurrentUsername, updateCurrentUser } from "@zoonk/core/users/current";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { logError } from "@zoonk/utils/logger";
import { redirect } from "next/navigation";
import { getCallbackHref } from "../../_utils/auth-redirect";

export type SetupState = { status: "error" | "idle" | "nameTooLong" };

export async function setupProfileAction(
  redirectTo: string | null,
  _prevState: SetupState,
  formData: FormData,
): Promise<SetupState> {
  const name = parseFormField(formData, "name");
  // Picked here, not on the page: a username taken since then gets a new one on the next try.
  const username = await suggestCurrentUsername();

  if (!name || !username) {
    return { status: "error" };
  }

  const { data, error } = await safeAsync(() => updateCurrentUser({ input: { name, username } }));
  const errorCode = getAuthError(error)?.code;

  if (errorCode === NAME_TOO_LONG_ERROR_CODE) {
    return { status: "nameTooLong" };
  }

  if (error || !data) {
    logError("Error setting up profile:", error);
    return { status: "error" };
  }

  redirect(getCallbackHref(redirectTo));
}

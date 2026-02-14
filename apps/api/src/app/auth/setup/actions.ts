"use server";

import { auth } from "@zoonk/core/auth";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { headers } from "next/headers";

type SetupState = { status: "idle" | "error" | "success" };

export async function setupProfileAction(
  _prevState: SetupState,
  formData: FormData,
): Promise<SetupState> {
  const name = parseFormField(formData, "name");
  const username = parseFormField(formData, "username");

  if (!name || !username) {
    return { status: "error" };
  }

  const { error } = await safeAsync(async () =>
    auth.api.updateUser({
      body: { name, username },
      headers: await headers(),
    }),
  );

  if (error) {
    console.error("Error setting up profile:", error);
    return { status: "error" };
  }

  return { status: "success" };
}

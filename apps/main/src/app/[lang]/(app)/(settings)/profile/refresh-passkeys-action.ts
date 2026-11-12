"use server";

import { expirePasskeys } from "@zoonk/core/users/passkeys";

export async function refreshPasskeysAction(): Promise<void> {
  await expirePasskeys();
}

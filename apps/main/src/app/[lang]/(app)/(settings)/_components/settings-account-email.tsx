import { getSession } from "@zoonk/core/users/session";

/** Which account these settings belong to; a guest has no email to show. */
export async function SettingsAccountEmail() {
  const session = await getSession();

  if (!session || session.user.isAnonymous) {
    return null;
  }

  return session.user.email;
}

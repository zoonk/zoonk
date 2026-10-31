import { getSession } from "@zoonk/core/users/session";
import { SettingsAccountButton } from "./settings-account-button";

export async function SettingsAccountAction() {
  const session = await getSession();

  if (!session) {
    return <SettingsAccountButton status="visitor" />;
  }

  return session.user.isAnonymous ? <SettingsAccountButton status="guest" /> : null;
}

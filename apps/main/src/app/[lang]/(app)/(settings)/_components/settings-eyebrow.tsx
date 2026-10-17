import { getActiveSubscription } from "@zoonk/core/auth/subscription";
import { getSession } from "@zoonk/core/users/session";
import { getExtracted } from "next-intl/server";

/**
 * Whose settings these are, over the section's title: the account's email, and "Plus" when that's
 * the plan. A guest or a visitor has no account to name.
 */
export async function SettingsEyebrow() {
  const t = await getExtracted();
  const [session, subscription] = await Promise.all([getSession(), getActiveSubscription()]);

  if (!session || session.user.isAnonymous) {
    return null;
  }

  return subscription ? t("{email} · Plus", { email: session.user.email }) : session.user.email;
}

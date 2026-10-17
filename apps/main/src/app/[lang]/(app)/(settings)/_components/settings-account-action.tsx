import { LearnerWitness } from "@/components/learner/learner-witness";
import { getSession } from "@zoonk/core/users/session";
import { SettingsAccountButton } from "./settings-account-button";

/**
 * The settings bar's one action, the way in: visitors log in and guests create the account that
 * keeps their plan. Accounts log out from the end of the settings list.
 */
export async function SettingsAccountAction() {
  const session = await getSession();

  if (!session) {
    return (
      <>
        <LearnerWitness />
        <SettingsAccountButton status="visitor" />
      </>
    );
  }

  if (!session.user.isAnonymous) {
    return null;
  }

  return (
    <>
      <LearnerWitness />
      <SettingsAccountButton status="guest" />
    </>
  );
}

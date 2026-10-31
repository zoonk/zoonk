import "server-only";
import { deleteUserDependenciesBeforeAuthDelete } from "@zoonk/auth/account-deletion";
import { prisma } from "@zoonk/db";
import { endWebPlusForDeletedAccount } from "../../subscriptions/web-plus-account-deletion";
import { logAccountDeletion } from "./log-account-deletion";

/**
 * An account Zoonk learns is below the minimum age is closed and refunded what its website Plus
 * paid (Terms § 2). It's deleted as the learner's own deletion would, without Better Auth's
 * fresh-session check, since the learner didn't ask for it.
 */
export async function closeUnderageAccount(user: { email: string; id: string; name: string }) {
  await endWebPlusForDeletedAccount({ learner: user, refund: "everything" });
  await deleteUserDependenciesBeforeAuthDelete(user);
  await prisma.user.delete({ where: { id: user.id } });
  await logAccountDeletion(user.id);
}

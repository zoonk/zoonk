import "server-only";
import { getPlusPurchaseStatus } from "@zoonk/auth/plus-purchase";
import { prisma } from "@zoonk/db";
import { sendPlusApprovalRequests } from "./_utils/guardian-emails";
import { getSignedInAccount } from "./_utils/signed-in-account";

/** A learner under 18 asks their guardians by email to approve Plus. Guests need an account. */
export async function requestPlusApproval(): Promise<{
  status: "accountRequired" | "noGuardian" | "notNeeded" | "requested" | "unauthorized";
}> {
  const account = await getSignedInAccount();

  if (!account) {
    return { status: "unauthorized" };
  }

  if (account.isAnonymous) {
    return { status: "accountRequired" };
  }

  if ((await getPlusPurchaseStatus(account.id)) !== "needsGuardianApproval") {
    return { status: "notNeeded" };
  }

  const links = await prisma.guardianLink.findMany({
    select: { guardianEmail: true },
    where: { status: "active", userId: account.id },
  });

  if (links.length === 0) {
    return { status: "noGuardian" };
  }

  await sendPlusApprovalRequests({
    guardianEmails: links.map((link) => link.guardianEmail),
    learnerName: account.name,
  });

  return { status: "requested" };
}

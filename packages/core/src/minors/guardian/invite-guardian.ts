import "server-only";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { sendGuardianInvite } from "./_utils/guardian-emails";
import { toGuardianLinkView } from "./_utils/guardian-link-view";
import { createGuardianToken } from "./_utils/guardian-token";
import { getSignedInAccount } from "./_utils/signed-in-account";
import { type GuardianInviteInput, type GuardianLinkView } from "./guardian-contract";

const INVITE_EXPIRY_DAYS = 7;

/** Invites send email to an address the learner types, so they're capped per day. */
const MAX_INVITES_PER_DAY = 5;

export type InviteGuardianResult =
  | { link: GuardianLinkView; status: "invited" }
  | { status: "accountRequired" | "invalidEmail" | "limitReached" | "notMinor" | "unauthorized" };

/**
 * A learner under 18 invites a guardian by email. The guardian can then see weekly activity, set
 * a daily time limit and approve Plus. A new invite replaces any invite still pending.
 */
export async function inviteGuardian({
  email,
}: GuardianInviteInput): Promise<InviteGuardianResult> {
  const account = await getSignedInAccount();

  if (!account) {
    return { status: "unauthorized" };
  }

  if (account.isAnonymous) {
    return { status: "accountRequired" };
  }

  if (account.ageGroup !== "teen") {
    return { status: "notMinor" };
  }

  const guardianEmail = email.trim().toLowerCase();

  if (guardianEmail === account.email) {
    return { status: "invalidEmail" };
  }

  const now = new Date();

  const invitesToday = await prisma.guardianLink.count({
    where: { createdAt: { gte: toUTCMidnight(now) }, userId: account.id },
  });

  if (invitesToday >= MAX_INVITES_PER_DAY) {
    return { status: "limitReached" };
  }

  const { token, tokenHash } = createGuardianToken();

  const link = await prisma.$transaction(async (transaction) => {
    await transaction.guardianLink.updateMany({
      data: { status: "revoked" },
      where: { status: "pending", userId: account.id },
    });

    return transaction.guardianLink.create({
      data: {
        expiresAt: new Date(now.getTime() + INVITE_EXPIRY_DAYS * MS_PER_DAY),
        guardianEmail,
        tokenHash,
        userId: account.id,
      },
    });
  });

  await sendGuardianInvite({ guardianEmail, learnerName: account.name, token });

  return { link: toGuardianLinkView(link), status: "invited" };
}

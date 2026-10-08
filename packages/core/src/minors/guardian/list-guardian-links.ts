import "server-only";
import { prisma } from "@zoonk/db";
import { getSession } from "../../users/get-session";
import { toGuardianLinkView } from "./_utils/guardian-link-view";
import { type GuardianLinkView } from "./guardian-contract";

/** The learner's guardians and pending invites, for their guardian settings. */
export async function listGuardianLinks(): Promise<GuardianLinkView[] | null> {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const links = await prisma.guardianLink.findMany({
    orderBy: { createdAt: "desc" },
    where: { status: { not: "revoked" }, userId: session.user.id },
  });

  return links.map((link) => toGuardianLinkView(link));
}

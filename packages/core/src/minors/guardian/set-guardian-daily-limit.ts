import "server-only";
import { prisma } from "@zoonk/db";
import { findGuardedLink } from "./_utils/guarded-link";

/** The guardian sets how many minutes a day the learner can study, or removes the limit. */
export async function setGuardianDailyLimit({
  dailyLimitMinutes,
  linkId,
}: {
  dailyLimitMinutes: number | null;
  linkId: string;
}): Promise<{ status: "notFound" | "unauthorized" | "updated" }> {
  const { link, signedIn } = await findGuardedLink(linkId);

  if (!signedIn) {
    return { status: "unauthorized" };
  }

  if (!link) {
    return { status: "notFound" };
  }

  await prisma.guardianLink.update({ data: { dailyLimitMinutes }, where: { id: link.id } });

  return { status: "updated" };
}

import "server-only";
import { prisma } from "@zoonk/db";
import { getAgeGroup, isValidBirthMonthYear } from "@zoonk/utils/age";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getLearningProfileCacheTag } from "../cache/tags";
import { deleteUnderageAccount } from "../minors/_utils/delete-underage-account";
import { getAdminAccess } from "../users/get-admin-access";

export type BirthCorrectionResult = {
  status: "accountDeleted" | "corrected" | "forbidden" | "invalid" | "notFound" | "unauthorized";
};

/**
 * Sets a learner's birth month and year for a support request, in any direction: learners can only
 * correct their own answer toward younger (`updateLearningProfile`), so an answer that makes them
 * older, which can lift a minor's protections, reaches support, who checks it first. Under 13
 * deletes the account, as the learner's own answer would. Only admins may do this.
 */
export async function correctBirthForSupport({
  birth,
  userId,
}: {
  birth: { month: number; year: number };
  userId: string;
}): Promise<BirthCorrectionResult> {
  const access = await getAdminAccess();

  if (access !== "ready") {
    return { status: access };
  }

  const answer = { birthMonth: birth.month, birthYear: birth.year };

  if (!isValidBirthMonthYear(answer)) {
    return { status: "invalid" };
  }

  const user = isUuid(userId)
    ? await prisma.user.findUnique({ select: { id: true }, where: { id: userId } })
    : null;

  if (!user) {
    return { status: "notFound" };
  }

  if (getAgeGroup(answer) === "child") {
    await deleteUnderageAccount(userId);
    return { status: "accountDeleted" };
  }

  await prisma.userLearningProfile.upsert({
    create: { ...answer, userId },
    update: answer,
    where: { userId },
  });

  revalidateCacheTags([getLearningProfileCacheTag(userId)]);

  return { status: "corrected" };
}

import "server-only";
import { prisma } from "@zoonk/db";
import { isCertainlyBelowMinimumAge, isValidBirthYear } from "@zoonk/utils/age";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getLearningProfileCacheTag } from "../cache/tags";
import { writeLearnerChange } from "../learner/_utils/write-learner-change";
import { closeUnderageAccount } from "../users/_utils/close-underage-account";
import { getAdminAccess } from "../users/get-admin-access";

export type BirthYearCorrection = {
  status:
    | "accountClosed"
    | "forbidden"
    | "invalidBirthYear"
    | "notFound"
    | "saved"
    | "unauthorized";
};

/**
 * Admins only, since learners give their year once. A year certainly below the minimum age
 * anywhere closes the account as the learner's own answer would (Terms § 2).
 */
export async function correctBirthYearForSupport({
  birthYear,
  userId,
}: {
  birthYear: number;
  userId: string;
}): Promise<BirthYearCorrection> {
  const access = await getAdminAccess();

  if (access !== "ready") {
    return { status: access };
  }

  const now = new Date();

  if (!isValidBirthYear({ birthYear, now })) {
    return { status: "invalidBirthYear" };
  }

  const user = isUuid(userId)
    ? await prisma.user.findUnique({
        select: { email: true, id: true, name: true },
        where: { id: userId },
      })
    : null;

  if (!user) {
    return { status: "notFound" };
  }

  if (isCertainlyBelowMinimumAge({ birthYear, country: null, now })) {
    await closeUnderageAccount(user);
    return { status: "accountClosed" };
  }

  await writeLearnerChange({ userId }, (transaction) =>
    transaction.userLearningProfile.upsert({
      create: { birthYear, userId },
      update: { birthYear },
      where: { userId },
    }),
  );

  revalidateCacheTags([getLearningProfileCacheTag(userId)]);
  return { status: "saved" };
}

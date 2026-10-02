import "server-only";
import { type PlusPurchaseStatus, getPlusPurchaseStatus } from "@zoonk/auth/plus-purchase";
import { prisma } from "@zoonk/db";
import { type AgeGroup, getAgeGroup } from "@zoonk/utils/age";
import { cacheTag } from "next/cache";
import { getLearningProfileCacheTag } from "../cache/tags";
import { getSession } from "../users/get-session";
import { type AgeProtections, getProtectionsForAgeGroup } from "./age-protections";

export type LearnerProtections = AgeProtections & {
  ageGroup: AgeGroup;
  plusPurchase: PlusPurchaseStatus;
};

/**
 * What the product may do for the learner in the session, from their age answer: session replay,
 * marketing email, which memories to keep, storing audio and buying Plus. Analytics, memory,
 * audio and checkout read these flags instead of checking age themselves.
 */
export async function getLearnerProtections(): Promise<LearnerProtections | null> {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return null;
  }

  const userId = session.user.id;

  cacheTag(getLearningProfileCacheTag(userId));

  const [profile, plusPurchase] = await Promise.all([
    prisma.userLearningProfile.findUnique({
      select: { birthMonth: true, birthYear: true },
      where: { userId },
    }),
    getPlusPurchaseStatus(userId),
  ]);

  const ageGroup = getAgeGroup({
    birthMonth: profile?.birthMonth ?? null,
    birthYear: profile?.birthYear ?? null,
  });

  return { ...getProtectionsForAgeGroup(ageGroup), ageGroup, plusPurchase };
}

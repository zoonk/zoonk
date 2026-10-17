import { type UserLearningProfile, prisma } from "@zoonk/db";
import { type FixtureAttrs } from "./_utils/fixture-attrs";

type LearningProfileAttrs = FixtureAttrs<UserLearningProfile, "interests" | "preferences"> &
  Pick<UserLearningProfile, "userId">;

/**
 * Sets a learner's profile (buddy, settings, active goal). Upserts because a learner has one
 * profile and other setup paths may already have created it.
 */
export async function learningProfileFixture(attrs: LearningProfileAttrs) {
  const { userId, ...data } = attrs;

  return prisma.userLearningProfile.upsert({
    create: { ...data, userId },
    update: data,
    where: { userId },
  });
}

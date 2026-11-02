import { type UserLearningProfile, prisma } from "@zoonk/db";
import { type FixtureAttrs } from "./_utils/fixture-attrs";

type LearningProfileAttrs = FixtureAttrs<UserLearningProfile, "interests" | "preferences"> &
  Pick<UserLearningProfile, "userId">;

export async function learningProfileFixture(attrs: LearningProfileAttrs) {
  const { userId, ...data } = attrs;

  return prisma.userLearningProfile.upsert({
    create: { ...data, userId },
    update: data,
    where: { userId },
  });
}

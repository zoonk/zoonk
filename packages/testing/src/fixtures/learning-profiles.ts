import { randomUUID } from "node:crypto";
import { type GuardianLink, type UserLearningProfile, prisma } from "@zoonk/db";
import { type FixtureAttrs } from "./_utils/fixture-attrs";

type LearningProfileAttrs = FixtureAttrs<UserLearningProfile, "interests" | "preferences"> &
  Pick<UserLearningProfile, "userId">;

/**
 * Sets a learner's profile (buddy, birth month and year, active goal). Upserts because a learner
 * has one profile and other setup paths may already have created it.
 */
export async function learningProfileFixture(attrs: LearningProfileAttrs) {
  const { userId, ...data } = attrs;

  return prisma.userLearningProfile.upsert({
    create: { ...data, userId },
    update: data,
    where: { userId },
  });
}

/** Invites a guardian by email. The stored token hash is unique per fixture. */
export async function guardianLinkFixture(
  attrs: FixtureAttrs<GuardianLink> & Pick<GuardianLink, "userId">,
) {
  const key = randomUUID();

  return prisma.guardianLink.create({
    data: {
      guardianEmail: `guardian-${key}@example.test`,
      tokenHash: `test-token-${key}`,
      ...attrs,
    },
  });
}

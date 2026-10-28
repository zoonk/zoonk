import { deleteUserDependenciesBeforeAuthDelete } from "@zoonk/auth/account-deletion";
import { prisma } from "@zoonk/db";
import { isLocalDevelopmentDatabase } from "@zoonk/db/local-database";
import { listSeedEmails } from "@zoonk/db/seed/emails";
import { getEnvironment } from "@zoonk/utils/environment";

/** The owner's account shouldn't exist locally; if it does, it isn't a test learner. */
const OWNER_EMAIL = "will3@zoonk.test";

/** Kept, so one paid onboarding serves every later `pnpm dev:persona --from` pass. */
export const ONBOARDED_PREFIX = "onboarded-";

/**
 * Only a local development database, so a typo in `DATABASE_URL` never reaches real learners. The
 * reason never repeats the URL, which holds the password.
 */
export function getTestLearnerRefusal(): string | null {
  const environment = getEnvironment();
  const databaseUrl = process.env.DATABASE_URL;

  if (environment !== "development") {
    return `this is the ${environment} environment, not development.`;
  }

  if (!databaseUrl || !isLocalDevelopmentDatabase(databaseUrl)) {
    return "DATABASE_URL isn't the local development database (zoonk on localhost).";
  }

  return null;
}

export function findTestLearners() {
  return prisma.user.findMany({
    include: { _count: { select: { goals: true, ownedCourses: true, ownedLessons: true } } },
    orderBy: { createdAt: "asc" },
    where: {
      NOT: { email: { startsWith: ONBOARDED_PREFIX } },
      email: { notIn: [...listSeedEmails(), OWNER_EMAIL] },
    },
  });
}

export function countOnboardedLearners() {
  return prisma.user.count({ where: { email: { startsWith: ONBOARDED_PREFIX } } });
}

/** Core's `deleteCurrentUser` can't be called here: it needs the learner's own fresh session. */
export async function removeTestLearner(learner: { email: string; id: string }) {
  await deleteUserDependenciesBeforeAuthDelete(learner);
  await prisma.user.delete({ where: { id: learner.id } });
}

export async function countSharedLibrary() {
  const where = { visibility: "public" } as const;

  const [courses, lessons, skills] = await Promise.all([
    prisma.course.count({ where }),
    prisma.lesson.count({ where }),
    prisma.skill.count({ where }),
  ]);

  return { courses, lessons, skills };
}

/** On the local database, every one of these rows is a test's. */
export async function countTestLeftovers() {
  const [guestSpendDays, accountDeletions] = await Promise.all([
    prisma.guestSpendDay.count(),
    prisma.accountDeletion.count(),
  ]);

  return { accountDeletions, guestSpendDays };
}

export async function clearTestLeftovers() {
  const [guestSpendDays, accountDeletions] = await Promise.all([
    prisma.guestSpendDay.deleteMany(),
    prisma.accountDeletion.deleteMany(),
  ]);

  return { accountDeletions: accountDeletions.count, guestSpendDays: guestSpendDays.count };
}

import { deleteUserDependenciesBeforeAuthDelete } from "@zoonk/auth/account-deletion";
import { prisma } from "@zoonk/db";
import { isLocalDevelopmentDatabase } from "@zoonk/db/local-database";
import { listSeedEmails } from "@zoonk/db/seed/emails";
import { getEnvironment } from "@zoonk/utils/environment";

/** The owner's own account. It shouldn't exist locally; if it does, it isn't a test learner. */
const OWNER_EMAIL = "will3@zoonk.test";

/**
 * Learners an onboarding pass made to copy from (`pnpm dev:persona --from`). They stay, so one
 * paid onboarding serves every later pass.
 */
export const ONBOARDED_PREFIX = "onboarded-";

/**
 * Why test learners can't be written or removed here, or null when they can: only on a local
 * development database outside production, so a typo in `DATABASE_URL` never reaches real
 * learners, the test database or the E2E one. The reason never repeats the URL, which holds the
 * password.
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

/** Every account and guest the seed didn't write, oldest first, with what they made. */
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

/** The onboarded learners kept for copying, to show they stay. */
export function countOnboardedLearners() {
  return prisma.user.count({ where: { email: { startsWith: ONBOARDED_PREFIX } } });
}

/**
 * Removes a learner the way deleting their account does: the cleanup Better Auth runs first
 * (private files, Apple grants, Stripe billing, codes), then the user, whose cascade takes
 * everything of theirs, private courses included. Shared Library content has no owner, so it stays.
 * Core's `deleteCurrentUser` can't be called here: it needs the learner's own fresh session. Unlike
 * it, nothing is logged for an admin to remove analytics, since these learners were never real.
 */
export async function removeTestLearner(learner: { email: string; id: string }) {
  await deleteUserDependenciesBeforeAuthDelete(learner);
  await prisma.user.delete({ where: { id: learner.id } });
}

/** How much shared Library content there is, to show it stays. */
export async function countSharedLibrary() {
  const where = { visibility: "public" } as const;

  const [courses, lessons, skills] = await Promise.all([
    prisma.course.count({ where }),
    prisma.lesson.count({ where }),
    prisma.skill.count({ where }),
  ]);

  return { courses, lessons, skills };
}

/**
 * Rows outside a learner's own that test passes leave behind: the AI budget guests share each day,
 * which the removed guests spent, and the entries in-app account deletions logged, which ask an
 * admin to remove analytics of people who were never real. On the local database every one is a
 * test's.
 */
export async function countTestLeftovers() {
  const [guestSpendDays, accountDeletions] = await Promise.all([
    prisma.guestSpendDay.count(),
    prisma.accountDeletion.count(),
  ]);

  return { accountDeletions, guestSpendDays };
}

/** Clears what `countTestLeftovers` counts, so a fresh pass starts with the guests' full budget. */
export async function clearTestLeftovers() {
  const [guestSpendDays, accountDeletions] = await Promise.all([
    prisma.guestSpendDay.deleteMany(),
    prisma.accountDeletion.deleteMany(),
  ]);

  return { accountDeletions: accountDeletions.count, guestSpendDays: guestSpendDays.count };
}

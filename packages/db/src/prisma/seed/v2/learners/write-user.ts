import { type PrismaClient } from "../../../../generated/prisma/client";
import { seedAccounts } from "../../accounts";
import { daysFrom } from "../_utils/dates";
import { seedId } from "../_utils/seed-id";
import { type SeedLearner } from "./types";

const SUBSCRIPTION_DAYS = 365;

/** The learner's account, credential login for tests, and Plus when the persona has it. */
async function writeAccount(prisma: PrismaClient, learner: SeedLearner): Promise<string> {
  const data = {
    email: learner.email,
    emailVerified: !learner.isAnonymous,
    isAnonymous: learner.isAnonymous ?? false,
    name: learner.name,
    role: "member",
    username: learner.username,
  };

  const user = await prisma.user.upsert({
    create: data,
    update: data,
    where: { email: learner.email },
  });

  if (!learner.isAnonymous) {
    await seedAccounts(prisma, { [learner.key]: user });
  }

  return user.id;
}

/** A year of Plus, granted by Zoonk rather than bought through a store. */
export function getSeedPlus({ now, userId }: { now: Date; userId: string }) {
  return {
    periodEnd: daysFrom(now, SUBSCRIPTION_DAYS),
    periodStart: now,
    plan: "plus",
    provider: "zoonk" as const,
    referenceId: userId,
    status: "active",
  };
}

async function writePlus({
  learner,
  now,
  prisma,
  userId,
}: {
  learner: SeedLearner;
  now: Date;
  prisma: PrismaClient;
  userId: string;
}) {
  const id = seedId(`learner:${learner.key}:subscription`);

  if (!learner.plus) {
    await prisma.subscription.deleteMany({ where: { id } });
    return;
  }

  const data = getSeedPlus({ now, userId });
  await prisma.subscription.upsert({ create: { id, ...data }, update: data, where: { id } });
}

/**
 * Creates or refreshes the learner's user, sign-in account, learning profile (buddy, daily limit)
 * and Plus. Returns the user id.
 */
export async function writeLearnerUser({
  learner,
  now,
  prisma,
}: {
  learner: SeedLearner;
  now: Date;
  prisma: PrismaClient;
}): Promise<string> {
  const userId = await writeAccount(prisma, learner);

  const profile = {
    buddyGlasses: learner.buddy?.glasses ?? "round",
    buddyKind: learner.buddy?.kind ?? null,
    buddyName: learner.buddy?.name ?? null,
    dailyLimitMinutes: learner.dailyLimitMinutes ?? null,
    memoryEnabled: true,
  };

  await Promise.all([
    prisma.userLearningProfile.upsert({
      create: { ...profile, userId },
      update: profile,
      where: { userId },
    }),
    writePlus({ learner, now, prisma, userId }),
  ]);

  return userId;
}

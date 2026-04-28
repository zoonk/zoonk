import { type Organization, type PrismaClient } from "../../generated/prisma/client";
import { type SeedUsers } from "./users";

// Deterministic random for reproducible seed data
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10_000;
  return x - Math.floor(x);
}

function buildOwnerDailyProgress(
  today: Date,
  userId: string,
): {
  brainPowerEarned: number;
  correctAnswers: number;
  date: Date;
  dayOfWeek: number;
  energyAtEnd: number;
  incorrectAnswers: number;
  interactiveCompleted: number;
  staticCompleted: number;
  timeSpentSeconds: number;
  userId: string;
}[] {
  const indices = Array.from({ length: 90 }, (_, i) => 89 - i);

  return indices
    .filter((i) => {
      // Add base offset of 1 to avoid seed=0 when i=0 (sin(0)=0 would always skip today)
      const seed = (i + 1) * 12_345;
      return seededRandom(seed) > 0.15;
    })
    .map((i) => {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const seed = (i + 1) * 12_345;
      const monthsAgo = Math.floor(i / 30);
      const baseEnergy = 72 - monthsAgo * 5;
      const energyVariation = (seededRandom(seed + 1) - 0.5) * 15;

      return {
        brainPowerEarned: 150 + Math.floor(seededRandom(seed + 2) * 350),
        correctAnswers: 12 + Math.floor(seededRandom(seed + 4) * 25),
        date,
        dayOfWeek: date.getDay(),
        energyAtEnd: Math.max(20, Math.min(95, baseEnergy + energyVariation)),
        incorrectAnswers: 1 + Math.floor(seededRandom(seed + 5) * 6),
        interactiveCompleted: 6 + Math.floor(seededRandom(seed + 6) * 12),
        staticCompleted: 3 + Math.floor(seededRandom(seed + 7) * 10),
        timeSpentSeconds: 900 + Math.floor(seededRandom(seed + 8) * 2100),
        userId,
      };
    });
}

async function seedUserProgress(prisma: PrismaClient, users: SeedUsers, now: Date) {
  await Promise.all([
    prisma.userProgress.upsert({
      create: {
        currentEnergy: 72.5,
        lastActiveAt: now,
        totalBrainPower: BigInt(15_750),
        userId: users.owner.id,
      },
      update: {},
      where: { userId: users.owner.id },
    }),
    prisma.userProgress.upsert({
      create: {
        currentEnergy: 45.2,
        lastActiveAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        totalBrainPower: BigInt(8500),
        userId: users.admin.id,
      },
      update: {},
      where: { userId: users.admin.id },
    }),
    prisma.userProgress.upsert({
      create: {
        currentEnergy: 15,
        lastActiveAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        totalBrainPower: BigInt(2100),
        userId: users.member.id,
      },
      update: {},
      where: { userId: users.member.id },
    }),
  ]);
}

async function seedStepAttempts(
  prisma: PrismaClient,
  org: Organization,
  users: SeedUsers,
  now: Date,
) {
  const lesson = await prisma.lesson.findFirst({
    where: {
      language: "en",
      organizationId: org.id,
      slug: "what-is-machine-learning",
    },
  });

  if (!lesson) {
    return;
  }

  const steps = await prisma.step.findMany({
    orderBy: { position: "asc" },
    where: { lessonId: lesson.id },
  });

  const firstStep = steps[0];
  if (!firstStep) {
    return;
  }

  const attemptData = steps.slice(0, 3).map((step, index) => ({
    answer: { selectedOption: index === 1 ? 0 : 1 },
    answeredAt: new Date(now.getTime() - (3 - index) * 60 * 1000),
    dayOfWeek: now.getDay(),
    durationSeconds: 15 + Math.floor(Math.random() * 30),
    hourOfDay: now.getHours(),
    isCorrect: index !== 1,
    stepId: step.id,
    userId: users.owner.id,
  }));

  await prisma.stepAttempt.createMany({
    data: attemptData,
  });

  await prisma.lessonProgress.upsert({
    create: {
      completedAt: now,
      durationSeconds: 180,
      lessonId: lesson.id,
      startedAt: new Date(now.getTime() - 3 * 60 * 1000),
      userId: users.owner.id,
    },
    update: {},
    where: {
      userLesson: {
        lessonId: lesson.id,
        userId: users.owner.id,
      },
    },
  });
}

export async function seedProgress(
  prisma: PrismaClient,
  org: Organization,
  users: SeedUsers,
): Promise<void> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  await seedUserProgress(prisma, users, now);

  const dailyProgressData = buildOwnerDailyProgress(today, users.owner.id);

  await Promise.all(
    dailyProgressData.map((data) =>
      prisma.dailyProgress.upsert({
        create: data,
        update: {},
        where: {
          userDate: {
            date: data.date,
            userId: data.userId,
          },
        },
      }),
    ),
  );

  await seedStepAttempts(prisma, org, users, now);
}

import type {
  Organization,
  PrismaClient,
  Step,
} from "../../generated/prisma/client";
import type { SeedUsers } from "./users";

type E2eAttemptData = {
  answer: { selectedOption: number };
  answeredAt: Date;
  dayOfWeek: number;
  durationSeconds: number;
  hourOfDay: number;
  isCorrect: boolean;
  organizationId: number;
  stepId: number;
  userId: number;
};

type DailyProgressInput = {
  brainPowerEarned: number;
  challengesCompleted: number;
  correctAnswers: number;
  date: Date;
  energyAtEnd: number;
  incorrectAnswers: number;
  interactiveCompleted: number;
  organizationId: number;
  staticCompleted: number;
  timeSpentSeconds: number;
  userId: number;
};

function buildE2eStepAttempts(
  step: Step,
  org: Organization,
  userId: number,
  now: Date,
): E2eAttemptData[] {
  const configs = [
    { correct: 9, hourOfDay: 9, incorrect: 1 }, // Morning: 90%
    { correct: 8, hourOfDay: 15, incorrect: 2 }, // Afternoon: 80%
    { correct: 7, hourOfDay: 21, incorrect: 3 }, // Evening: 70%
  ];

  const attempts: E2eAttemptData[] = [];

  for (const config of configs) {
    for (let i = 0; i < config.correct; i++) {
      attempts.push({
        answer: { selectedOption: 1 },
        answeredAt: new Date(now.getTime() - i * 60 * 1000),
        dayOfWeek: now.getDay(),
        durationSeconds: 15,
        hourOfDay: config.hourOfDay,
        isCorrect: true,
        organizationId: org.id,
        stepId: step.id,
        userId,
      });
    }

    for (let i = 0; i < config.incorrect; i++) {
      attempts.push({
        answer: { selectedOption: 0 },
        answeredAt: new Date(now.getTime() - (config.correct + i) * 60 * 1000),
        dayOfWeek: now.getDay(),
        durationSeconds: 15,
        hourOfDay: config.hourOfDay,
        isCorrect: false,
        organizationId: org.id,
        stepId: step.id,
        userId,
      });
    }
  }

  return attempts;
}

// Deterministic random for reproducible seed data
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10_000;
  return x - Math.floor(x);
}

function buildOwnerDailyProgress(
  today: Date,
  orgId: number,
  userId: number,
): DailyProgressInput[] {
  const data: DailyProgressInput[] = [];

  for (let i = 89; i >= 0; i--) {
    const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const seed = i * 12_345;
    const isActiveDay = seededRandom(seed) > 0.15;

    if (!isActiveDay) {
      continue;
    }

    const monthsAgo = Math.floor(i / 30);
    const baseEnergy = 72 - monthsAgo * 5;
    const energyVariation = (seededRandom(seed + 1) - 0.5) * 15;

    data.push({
      brainPowerEarned: 150 + Math.floor(seededRandom(seed + 2) * 350),
      challengesCompleted: seededRandom(seed + 3) > 0.7 ? 1 : 0,
      correctAnswers: 12 + Math.floor(seededRandom(seed + 4) * 25),
      date,
      energyAtEnd: Math.max(20, Math.min(95, baseEnergy + energyVariation)),
      incorrectAnswers: 1 + Math.floor(seededRandom(seed + 5) * 6),
      interactiveCompleted: 6 + Math.floor(seededRandom(seed + 6) * 12),
      organizationId: orgId,
      staticCompleted: 3 + Math.floor(seededRandom(seed + 7) * 10),
      timeSpentSeconds: 900 + Math.floor(seededRandom(seed + 8) * 2100),
      userId,
    });
  }

  return data;
}

function buildE2eDailyProgress(
  today: Date,
  orgId: number,
  userId: number,
): DailyProgressInput[] {
  const data: DailyProgressInput[] = [];

  // 60 days: current month (75% energy), previous month (65% energy)
  for (let i = 59; i >= 0; i--) {
    const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const isCurrentMonth = i < 30;
    const energy = isCurrentMonth ? 75 : 65;
    const correctAnswers = isCurrentMonth ? 17 : 13;
    const incorrectAnswers = isCurrentMonth ? 3 : 7;

    data.push({
      brainPowerEarned: 300,
      challengesCompleted: 0,
      correctAnswers,
      date,
      energyAtEnd: energy,
      incorrectAnswers,
      interactiveCompleted: 10,
      organizationId: orgId,
      staticCompleted: 5,
      timeSpentSeconds: 1800,
      userId,
    });
  }

  return data;
}

async function seedUserProgress(
  prisma: PrismaClient,
  users: SeedUsers,
  now: Date,
) {
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
        currentEnergy: 15.0,
        lastActiveAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        totalBrainPower: BigInt(2100),
        userId: users.member.id,
      },
      update: {},
      where: { userId: users.member.id },
    }),
    prisma.userProgress.upsert({
      create: {
        currentEnergy: 75.0,
        lastActiveAt: now,
        totalBrainPower: BigInt(15_000),
        userId: users.e2eWithProgress.id,
      },
      update: {},
      where: { userId: users.e2eWithProgress.id },
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

  const activity = await prisma.activity.findFirst({
    where: { lessonId: lesson.id, position: 2 },
  });

  if (!activity) {
    return;
  }

  const steps = await prisma.step.findMany({
    orderBy: { position: "asc" },
    where: { activityId: activity.id },
  });

  const firstStep = steps[0];
  if (!firstStep) {
    return;
  }

  const attemptData = steps.slice(0, 3).map((s, index) => ({
    answer: { selectedOption: index === 1 ? 0 : 1 },
    answeredAt: new Date(now.getTime() - (3 - index) * 60 * 1000),
    dayOfWeek: now.getDay(),
    durationSeconds: 15 + Math.floor(Math.random() * 30),
    hourOfDay: now.getHours(),
    isCorrect: index !== 1,
    organizationId: org.id,
    stepId: s.id,
    userId: users.owner.id,
  }));

  const e2eAttemptData = buildE2eStepAttempts(
    firstStep,
    org,
    users.e2eWithProgress.id,
    now,
  );

  await Promise.all([
    ...attemptData.map((data) => prisma.stepAttempt.create({ data })),
    ...e2eAttemptData.map((data) => prisma.stepAttempt.create({ data })),
  ]);

  await prisma.activityProgress.upsert({
    create: {
      activityId: activity.id,
      completedAt: now,
      durationSeconds: 180,
      startedAt: new Date(now.getTime() - 3 * 60 * 1000),
      userId: users.owner.id,
    },
    update: {},
    where: {
      userActivity: {
        activityId: activity.id,
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

  const dailyProgressData = [
    ...buildOwnerDailyProgress(today, org.id, users.owner.id),
    ...buildE2eDailyProgress(today, org.id, users.e2eWithProgress.id),
  ];

  await Promise.all(
    dailyProgressData.map((data) =>
      prisma.dailyProgress.upsert({
        create: data,
        update: {},
        where: {
          userDateOrg: {
            date: data.date,
            organizationId: data.organizationId,
            userId: data.userId,
          },
        },
      }),
    ),
  );

  await seedStepAttempts(prisma, org, users, now);
}

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

export async function seedProgress(
  prisma: PrismaClient,
  org: Organization,
  users: SeedUsers,
): Promise<void> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

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

  const dailyProgressData: DailyProgressInput[] = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const isActiveDay = i !== 3 && i !== 5;

    if (isActiveDay) {
      dailyProgressData.push({
        brainPowerEarned: 200 + Math.floor(Math.random() * 300),
        challengesCompleted: i === 0 ? 1 : 0,
        correctAnswers: 15 + Math.floor(Math.random() * 20),
        date,
        energyAtEnd: 65 + Math.random() * 10,
        incorrectAnswers: 2 + Math.floor(Math.random() * 5),
        interactiveCompleted: 8 + Math.floor(Math.random() * 10),
        organizationId: org.id,
        staticCompleted: 5 + Math.floor(Math.random() * 8),
        timeSpentSeconds: 1200 + Math.floor(Math.random() * 1800),
        userId: users.owner.id,
      });
    }

    dailyProgressData.push({
      brainPowerEarned: 300,
      challengesCompleted: 0,
      correctAnswers: 17,
      date,
      energyAtEnd: 75,
      incorrectAnswers: 3,
      interactiveCompleted: 10,
      organizationId: org.id,
      staticCompleted: 5,
      timeSpentSeconds: 1800,
      userId: users.e2eWithProgress.id,
    });
  }

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

  if (steps.length === 0) {
    return;
  }

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

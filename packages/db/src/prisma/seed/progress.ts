import type { Organization, PrismaClient } from "../../generated/prisma/client";
import type { SeedUsers } from "./users";

export async function seedProgress(
  prisma: PrismaClient,
  org: Organization,
  users: SeedUsers,
): Promise<void> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Create UserProgress for each user
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
        lastActiveAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        totalBrainPower: BigInt(8500),
        userId: users.admin.id,
      },
      update: {},
      where: { userId: users.admin.id },
    }),
    prisma.userProgress.upsert({
      create: {
        currentEnergy: 15.0,
        lastActiveAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        totalBrainPower: BigInt(2100),
        userId: users.member.id,
      },
      update: {},
      where: { userId: users.member.id },
    }),
    // E2E user progress (deterministic values for testing)
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

  // Create DailyProgress for the past 7 days for the owner user
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
    const isActiveDay = i !== 3 && i !== 5; // Skip days 3 and 5 (inactive days)

    if (isActiveDay) {
      dailyProgressData.push({
        brainPowerEarned: 200 + Math.floor(Math.random() * 300),
        challengesCompleted: i === 0 ? 1 : 0, // Completed a challenge today
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

  // Create some sample step attempts
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
    where: {
      lessonId: lesson.id,
      position: 2, // explanation_quiz
    },
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

  // Create attempts for the owner user
  const attemptData = steps.slice(0, 3).map((step, index) => ({
    answer: { selectedOption: index === 1 ? 0 : 1 },
    answeredAt: new Date(now.getTime() - (3 - index) * 60 * 1000),
    dayOfWeek: now.getDay(),
    durationSeconds: 15 + Math.floor(Math.random() * 30),
    hourOfDay: now.getHours(),
    isCorrect: index !== 1, // Second attempt is wrong
    organizationId: org.id,
    stepId: step.id,
    userId: users.owner.id,
  }));

  await Promise.all(
    attemptData.map((data) =>
      prisma.stepAttempt.create({
        data,
      }),
    ),
  );

  // Create activity progress
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

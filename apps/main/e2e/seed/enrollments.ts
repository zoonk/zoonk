import type { Organization, PrismaClient } from "@zoonk/db";
import type { E2EUsers } from "./users";

export async function seedCourseUsers(
  prisma: PrismaClient,
  org: Organization,
  users: E2EUsers,
): Promise<void> {
  const courses = await prisma.course.findMany({
    orderBy: { id: "asc" },
    take: 5,
    where: { isPublished: true, language: "en", organizationId: org.id },
  });

  if (courses.length === 0) {
    return;
  }

  // Enroll withProgress user in all courses with staggered start times
  const now = new Date();
  await Promise.all(
    courses.map((course, index) =>
      prisma.courseUser.upsert({
        create: {
          courseId: course.id,
          startedAt: new Date(now.getTime() - index * 60 * 60 * 1000),
          userId: users.withProgress.id,
        },
        update: {},
        where: {
          courseUser: {
            courseId: course.id,
            userId: users.withProgress.id,
          },
        },
      }),
    ),
  );
}

export async function seedProgress(
  prisma: PrismaClient,
  org: Organization,
  users: E2EUsers,
): Promise<void> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Create UserProgress for withProgress user (deterministic values, no Math.random)
  await prisma.userProgress.upsert({
    create: {
      currentEnergy: 75.0,
      lastActiveAt: now,
      totalBrainPower: BigInt(15_000),
      userId: users.withProgress.id,
    },
    update: {},
    where: { userId: users.withProgress.id },
  });

  // Create DailyProgress for the past 5 days (deterministic)
  const dailyProgressData = [
    {
      brainPowerEarned: 350,
      challengesCompleted: 1,
      correctAnswers: 25,
      date: new Date(today.getTime() - 0 * 24 * 60 * 60 * 1000),
      energyAtEnd: 75.0,
      incorrectAnswers: 3,
      interactiveCompleted: 12,
      organizationId: org.id,
      staticCompleted: 8,
      timeSpentSeconds: 1800,
      userId: users.withProgress.id,
    },
    {
      brainPowerEarned: 280,
      challengesCompleted: 0,
      correctAnswers: 18,
      date: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000),
      energyAtEnd: 68.0,
      incorrectAnswers: 4,
      interactiveCompleted: 10,
      organizationId: org.id,
      staticCompleted: 6,
      timeSpentSeconds: 1500,
      userId: users.withProgress.id,
    },
    {
      brainPowerEarned: 420,
      challengesCompleted: 1,
      correctAnswers: 30,
      date: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
      energyAtEnd: 72.0,
      incorrectAnswers: 2,
      interactiveCompleted: 15,
      organizationId: org.id,
      staticCompleted: 10,
      timeSpentSeconds: 2100,
      userId: users.withProgress.id,
    },
    {
      brainPowerEarned: 200,
      challengesCompleted: 0,
      correctAnswers: 12,
      date: new Date(today.getTime() - 4 * 24 * 60 * 60 * 1000),
      energyAtEnd: 60.0,
      incorrectAnswers: 5,
      interactiveCompleted: 8,
      organizationId: org.id,
      staticCompleted: 4,
      timeSpentSeconds: 1200,
      userId: users.withProgress.id,
    },
    {
      brainPowerEarned: 380,
      challengesCompleted: 1,
      correctAnswers: 22,
      date: new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000),
      energyAtEnd: 70.0,
      incorrectAnswers: 3,
      interactiveCompleted: 14,
      organizationId: org.id,
      staticCompleted: 7,
      timeSpentSeconds: 1900,
      userId: users.withProgress.id,
    },
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

  // Create activity progress for the first lesson
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

  // Check if activity progress already exists
  const existingProgress = await prisma.activityProgress.findFirst({
    where: {
      activityId: activity.id,
      userId: users.withProgress.id,
    },
  });

  if (!existingProgress) {
    await prisma.activityProgress.create({
      data: {
        activityId: activity.id,
        completedAt: now,
        durationSeconds: 180,
        startedAt: new Date(now.getTime() - 3 * 60 * 1000),
        userId: users.withProgress.id,
      },
    });
  }

  // Create step attempts
  const steps = await prisma.step.findMany({
    orderBy: { position: "asc" },
    take: 3,
    where: { activityId: activity.id },
  });

  if (steps.length === 0) {
    return;
  }

  // Check if step attempts already exist
  const existingAttempts = await prisma.stepAttempt.count({
    where: {
      stepId: { in: steps.map((s) => s.id) },
      userId: users.withProgress.id,
    },
  });

  if (existingAttempts > 0) {
    return;
  }

  const attemptData = steps.map((step, index) => ({
    answer: { selectedOption: index === 1 ? 0 : 1 },
    answeredAt: new Date(now.getTime() - (3 - index) * 60 * 1000),
    dayOfWeek: now.getDay(),
    durationSeconds: 20 + index * 5,
    hourOfDay: now.getHours(),
    isCorrect: index !== 1,
    organizationId: org.id,
    stepId: step.id,
    userId: users.withProgress.id,
  }));

  await Promise.all(
    attemptData.map((data) => prisma.stepAttempt.create({ data })),
  );
}

import { randomUUID } from "node:crypto";
import { type Locator, expect, request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import {
  dailyProgressFixtureMany,
  stepAttemptFixture,
  userProgressFixture,
} from "@zoonk/testing/fixtures/progress";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";

export function getBaseURL(): string {
  const url = process.env.E2E_BASE_URL;

  if (!url) {
    throw new Error("E2E_BASE_URL not set. Is the webServer running?");
  }

  return url;
}

/**
 * Get or create the AI organization using Prisma directly.
 * Avoids importing from @zoonk/testing/fixtures/orgs which pulls in
 * @zoonk/auth (depends on next/headers, unavailable in Playwright).
 */
export async function getAiOrganization() {
  return prisma.organization.upsert({
    create: { kind: "brand", name: "Zoonk AI", slug: AI_ORG_SLUG },
    update: {},
    where: { slug: AI_ORG_SLUG },
  });
}

export type E2EUser = {
  email: string;
  id: number;
  password: string;
  storageState: Awaited<ReturnType<Awaited<ReturnType<typeof request.newContext>>["storageState"]>>;
};

export async function createE2EUser(
  baseURL: string,
  options?: {
    orgRole?: "admin" | "member" | "owner";
    orgSlug?: string;
    withProgress?: boolean;
    withSubscription?: boolean;
  },
): Promise<E2EUser> {
  const uniqueId = randomUUID().slice(0, 8);
  const email = `e2e-${uniqueId}@zoonk.test`;
  const password = "password123";
  const name = `E2E User ${uniqueId}`;

  const signupContext = await request.newContext({ baseURL });
  const signupResponse = await signupContext.post("/api/auth/sign-up/email", {
    data: { email, name, password },
  });

  if (!signupResponse.ok()) {
    const body = await signupResponse.text();
    throw new Error(`Sign-up failed for ${email}: ${signupResponse.status()} - ${body}`);
  }

  await signupContext.dispose();

  const user = await prisma.user.findUniqueOrThrow({ where: { email } });

  // Set username — sign-up API doesn't create one, but profile form requires it
  await prisma.user.update({
    data: { username: `e2e_${uniqueId}` },
    where: { id: user.id },
  });

  if (options?.orgRole) {
    const org = options.orgSlug
      ? await prisma.organization.findUniqueOrThrow({ where: { slug: options.orgSlug } })
      : await getAiOrganization();

    await prisma.member.create({
      data: {
        organizationId: org.id,
        role: options.orgRole,
        userId: user.id,
      },
    });
  }

  if (options?.withSubscription) {
    await prisma.subscription.create({
      data: {
        plan: "hobby",
        referenceId: String(user.id),
        status: "active",
        stripeCustomerId: `cus_e2e_${uniqueId}`,
        stripeSubscriptionId: `sub_e2e_${uniqueId}`,
      },
    });
  }

  if (options?.withProgress) {
    await createE2EProgressData(user.id);
  }

  const signinContext = await request.newContext({ baseURL });
  const signinResponse = await signinContext.post("/api/auth/sign-in/email", {
    data: { email, password },
  });

  if (!signinResponse.ok()) {
    const body = await signinResponse.text();
    throw new Error(`Sign-in failed for ${email}: ${signinResponse.status()} - ${body}`);
  }

  const storageState = await signinContext.storageState();
  await signinContext.dispose();

  return { email, id: user.id, password, storageState };
}

/**
 * Click a dialog trigger and wait for the dialog to open.
 * Retries the click if the dialog doesn't appear (handles pre-hydration timing).
 * Uses a visibility guard to avoid toggling the dialog closed on retry.
 */
export async function openDialog(trigger: Locator, dialog: Locator) {
  await expect(async () => {
    if (!(await dialog.isVisible())) {
      await trigger.click();
    }
    await expect(dialog).toBeVisible({ timeout: 1000 });
  }).toPass();
}

function buildDailyProgressInputs(today: Date, orgId: number, userId: number) {
  return Array.from({ length: 60 }, (_, reverseIdx) => {
    const idx = 59 - reverseIdx;
    const date = new Date(today.getTime() - idx * 24 * 60 * 60 * 1000);
    const isCurrentMonth = idx < 30;

    return {
      brainPowerEarned: 250,
      correctAnswers: isCurrentMonth ? 17 : 13,
      date,
      energyAtEnd: isCurrentMonth ? 75 : 65,
      incorrectAnswers: isCurrentMonth ? 3 : 7,
      organizationId: orgId,
      userId,
    };
  });
}

async function createStepAttempts(
  stepId: bigint,
  orgId: number,
  userId: number,
  now: Date,
): Promise<void> {
  const configs = [
    { correct: 9, hourOfDay: 9, incorrect: 1 },
    { correct: 8, hourOfDay: 15, incorrect: 2 },
    { correct: 7, hourOfDay: 21, incorrect: 3 },
  ];

  const attempts = configs.flatMap((config) => [
    ...Array.from({ length: config.correct }, (_, idx) => ({
      answer: { selectedOption: 1 },
      answeredAt: new Date(now.getTime() - idx * 60 * 1000),
      dayOfWeek: now.getDay(),
      durationSeconds: 15,
      hourOfDay: config.hourOfDay,
      isCorrect: true,
      organizationId: orgId,
      stepId,
      userId,
    })),
    ...Array.from({ length: config.incorrect }, (_, idx) => ({
      answer: { selectedOption: 0 },
      answeredAt: new Date(now.getTime() - (config.correct + idx) * 60 * 1000),
      dayOfWeek: now.getDay(),
      durationSeconds: 15,
      hourOfDay: config.hourOfDay,
      isCorrect: false,
      organizationId: orgId,
      stepId,
      userId,
    })),
  ]);

  await Promise.all(attempts.map((attempt) => stepAttemptFixture(attempt)));
}

async function createE2EProgressData(userId: number): Promise<void> {
  const org = await getAiOrganization();
  const uniqueId = randomUUID().slice(0, 8);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-progress-course-${uniqueId}`,
    title: `E2E Progress Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    generationStatus: "completed",
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-progress-chapter-${uniqueId}`,
    title: `E2E Progress Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    generationStatus: "completed",
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-progress-lesson-${uniqueId}`,
    title: `E2E Progress Lesson ${uniqueId}`,
  });

  // Create two activities: complete the first, leave the second as "next"
  // so getContinueLearning has a next activity to return.
  const [completedActivity, _nextActivity] = await Promise.all([
    activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "background",
      lessonId: lesson.id,
      organizationId: org.id,
      position: 0,
      title: `E2E Completed Activity ${uniqueId}`,
    }),
    activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "quiz",
      lessonId: lesson.id,
      organizationId: org.id,
      position: 1,
      title: `E2E Next Activity ${uniqueId}`,
    }),
  ]);

  const step = await stepFixture({
    activityId: completedActivity.id,
    content: { text: "E2E step content", title: "E2E Step" },
    isPublished: true,
    kind: "multipleChoice",
  });

  await userProgressFixture({
    currentEnergy: 75,
    totalBrainPower: 15_000n,
    userId,
  });

  await dailyProgressFixtureMany(buildDailyProgressInputs(today, org.id, userId));

  await createStepAttempts(step.id, org.id, userId, now);

  await Promise.all([
    prisma.activityProgress.create({
      data: {
        activityId: completedActivity.id,
        completedAt: new Date(now.getTime() - 60 * 1000),
        durationSeconds: 120,
        startedAt: new Date(now.getTime() - 180 * 1000),
        userId,
      },
    }),
    prisma.courseUser.create({
      data: { courseId: course.id, userId },
    }),
  ]);
}

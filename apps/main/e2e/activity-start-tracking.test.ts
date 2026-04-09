import { randomUUID } from "node:crypto";
import { type Browser } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { request } from "@zoonk/e2e/fixtures";
import { getAiOrganization } from "@zoonk/e2e/helpers";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { expect, test } from "./fixtures";

async function createUniqueUser(baseURL: string) {
  const uniqueId = randomUUID().slice(0, 8);
  const email = `e2e-start-${uniqueId}@zoonk.test`;

  const signupContext = await request.newContext({ baseURL });
  const response = await signupContext.post("/api/auth/sign-up/email", {
    data: { email, name: `E2E Start ${uniqueId}`, password: "password123" },
  });

  expect(response.ok()).toBe(true);
  await signupContext.dispose();

  return email;
}

async function createAuthenticatedPage(browser: Browser, baseURL: string, email: string) {
  const context = await request.newContext({ baseURL });

  await context.post("/api/auth/sign-in/email", {
    data: { email, password: "password123" },
  });

  const storageState = await context.storageState();
  await context.dispose();

  const browserContext = await browser.newContext({ storageState });
  const page = await browserContext.newPage();

  return { browserContext, page };
}

async function createTestActivity() {
  const org = await getAiOrganization();
  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-start-course-${uniqueId}`,
    title: `E2E Start Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-start-chapter-${uniqueId}`,
    title: `E2E Start Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-start-lesson-${uniqueId}`,
    title: `E2E Start Lesson ${uniqueId}`,
  });

  const activity = await activityFixture({
    generationStatus: "completed",
    isPublished: true,
    kind: "explanation",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 0,
  });

  await stepFixture({
    activityId: activity.id,
    content: { text: `Step content ${uniqueId}`, title: `Step ${uniqueId}`, variant: "text" },
    isPublished: true,
    position: 0,
  });

  const url = `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/0`;

  return { activity, url };
}

test.describe("Activity Start Tracking", () => {
  test("authenticated user visiting activity page creates start record", async ({
    baseURL,
    browser,
  }) => {
    const [email, { activity, url }] = await Promise.all([
      createUniqueUser(baseURL!),
      createTestActivity(),
    ]);

    const { browserContext, page } = await createAuthenticatedPage(browser, baseURL!, email);

    const user = await prisma.user.findFirst({ where: { email } });
    expect(user).not.toBeNull();
    const userId = user!.id;

    const before = await prisma.activityProgress.findUnique({
      where: { userActivity: { activityId: activity.id, userId } },
    });
    expect(before).toBeNull();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    // after() runs asynchronously — use toPass retry pattern
    await expect(async () => {
      const progress = await prisma.activityProgress.findUnique({
        where: { userActivity: { activityId: activity.id, userId } },
      });

      expect(progress).not.toBeNull();
      expect(progress?.completedAt).toBeNull();
      expect(progress?.durationSeconds).toBeNull();
    }).toPass({ timeout: 5000 });

    await browserContext.close();
  });

  test("guest user visiting activity page does not create start record", async ({ page }) => {
    const { activity, url } = await createTestActivity();

    await page.goto(url);
    await expect(page.getByRole("link", { name: /close/i })).toBeVisible();

    const progress = await prisma.activityProgress.findFirst({
      where: { activityId: activity.id },
    });

    expect(progress).toBeNull();
  });
});

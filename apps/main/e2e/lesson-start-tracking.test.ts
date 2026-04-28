import { randomUUID } from "node:crypto";
import { type Browser } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { request } from "@zoonk/e2e/fixtures";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
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

async function createTestLesson() {
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
    generationStatus: "completed",
    isPublished: true,
    kind: "explanation",
    organizationId: org.id,
    slug: `e2e-start-lesson-${uniqueId}`,
    title: `E2E Start Lesson ${uniqueId}`,
  });

  await stepFixture({
    content: { text: `Step content ${uniqueId}`, title: `Step ${uniqueId}`, variant: "text" },
    isPublished: true,
    lessonId: lesson.id,
    position: 0,
  });

  const url = `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`;

  return { lesson, url };
}

test.describe("Lesson Start Tracking", () => {
  test("authenticated user visiting lesson player creates start record", async ({
    baseURL,
    browser,
  }) => {
    const [email, { lesson, url }] = await Promise.all([
      createUniqueUser(baseURL!),
      createTestLesson(),
    ]);

    const { browserContext, page } = await createAuthenticatedPage(browser, baseURL!, email);

    const user = await prisma.user.findFirst({ where: { email } });
    expect(user).not.toBeNull();
    const userId = user!.id;

    const before = await prisma.lessonProgress.findUnique({
      where: { userLesson: { lessonId: lesson.id, userId } },
    });
    expect(before).toBeNull();

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    // after() runs asynchronously — use toPass retry pattern
    await expect(async () => {
      const progress = await prisma.lessonProgress.findUnique({
        where: { userLesson: { lessonId: lesson.id, userId } },
      });

      expect(progress).not.toBeNull();
      expect(progress?.completedAt).toBeNull();
      expect(progress?.durationSeconds).toBeNull();
    }).toPass({ timeout: 5000 });

    await browserContext.close();
  });

  test("guest user visiting lesson player does not create start record", async ({ page }) => {
    const { lesson, url } = await createTestLesson();

    await page.goto(url);
    await expect(page.getByRole("link", { name: /close/i })).toBeVisible();

    const progress = await prisma.lessonProgress.findFirst({
      where: { lessonId: lesson.id },
    });

    expect(progress).toBeNull();
  });
});

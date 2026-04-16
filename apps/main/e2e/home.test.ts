import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { activityFixture, activityProgressFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { userProgressFixture } from "@zoonk/testing/fixtures/progress";
import { expect, test } from "./fixtures";

test.describe("Home Page - Unauthenticated", () => {
  test("shows hero with CTAs that navigate to correct pages", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/continue learning/i)).not.toBeVisible();

    const hero = page.getByRole("main");

    await expect(hero.getByRole("heading", { name: /learn anything with ai/i })).toBeVisible();

    // Test Learn anything CTA
    await hero.getByRole("link", { exact: true, name: "Learn anything" }).click();

    await expect(page.getByRole("heading", { name: /learn anything/i })).toBeVisible();
  });

  test("does not show performance section", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/^performance$/i)).not.toBeVisible();
  });
});

test.describe("Home Page - Authenticated", () => {
  test("user with progress sees continue learning instead of hero", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/");

    // Use .first() to handle potential duplicates during streaming/hydration
    await expect(
      authenticatedPage.getByRole("heading", { name: /continue learning/i }).first(),
    ).toBeVisible();

    await expect(
      authenticatedPage.getByRole("heading", {
        name: /learn anything with ai/i,
      }),
    ).not.toBeVisible();
  });

  test("user without progress sees hero section", async ({ userWithoutProgress }) => {
    await userWithoutProgress.goto("/");

    await expect(userWithoutProgress.getByText(/continue learning/i)).not.toBeVisible();

    await expect(
      userWithoutProgress.getByRole("heading", {
        name: /learn anything with ai/i,
      }),
    ).toBeVisible();
  });

  test("shows pending course when next lesson has no generated activities", async ({
    baseURL,
    browser,
  }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const org = await getAiOrganization();
    const user = await createE2EUser(baseURL!);

    const course = await courseFixture({
      isPublished: true,
      organizationId: org.id,
      slug: `e2e-pending-course-${uniqueId}`,
      title: `E2E Pending Course ${uniqueId}`,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: org.id,
      position: 0,
    });

    const lesson1 = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: org.id,
      position: 0,
    });

    await lessonFixture({
      chapterId: chapter.id,
      description: `E2E Pending Lesson Description ${uniqueId}`,
      generationStatus: "pending",
      isPublished: true,
      organizationId: org.id,
      position: 1,
      title: `E2E Pending Lesson ${uniqueId}`,
    });

    const activity = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      lessonId: lesson1.id,
      organizationId: org.id,
      position: 0,
    });

    await Promise.all([
      activityProgressFixture({
        activityId: activity.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: user.id,
      }),
      userProgressFixture({ totalBrainPower: 100n, userId: user.id }),
      prisma.courseUser.create({ data: { courseId: course.id, userId: user.id } }),
    ]);

    const ctx = await browser.newContext({ storageState: user.storageState });
    const page = await ctx.newPage();

    await page.goto("/");

    await expect(page.getByRole("heading", { name: /continue learning/i }).first()).toBeVisible();

    await expect(page.getByRole("heading", { name: /learn anything with ai/i })).not.toBeVisible();

    await expect(page.getByRole("link", { name: /continue/i }).first()).toBeVisible();
    await expect(page.getByText(new RegExp(`E2E Pending Course ${uniqueId}`))).toBeVisible();
    await expect(page.getByText(new RegExp(`E2E Pending Lesson ${uniqueId}`))).toBeVisible();

    await ctx.close();
  });

  test("does not show archived courses in continue learning", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const org = await getAiOrganization();

    const course = await courseFixture({
      archivedAt: new Date(),
      isPublished: true,
      organizationId: org.id,
      slug: `e2e-archived-home-course-${uniqueId}`,
      title: `E2E Archived Home Course ${uniqueId}`,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: org.id,
      position: 0,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: org.id,
      position: 0,
    });

    const activity = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      lessonId: lesson.id,
      organizationId: org.id,
      position: 0,
    });

    await Promise.all([
      activityProgressFixture({
        activityId: activity.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: withProgressUser.id,
      }),
      prisma.courseUser.create({
        data: {
          courseId: course.id,
          userId: withProgressUser.id,
        },
      }),
    ]);

    await authenticatedPage.goto("/");

    await expect(
      authenticatedPage.getByRole("heading", { name: /continue learning/i }).first(),
    ).toBeVisible();
    await expect(authenticatedPage.getByText(course.title)).not.toBeVisible();
  });
});

test.describe("Home Page - Performance Section", () => {
  test("authenticated user with progress sees energy level", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/");

    // Wait for Suspense content to load - Performance section only renders when data is available
    await expect(authenticatedPage.getByText(/^performance$/i)).toBeVisible();

    // Use regex to match "Your energy is X%" where X can be any number (including decimals)
    await expect(authenticatedPage.getByText(/your energy is \d+(\.\d+)?%/i)).toBeVisible();
  });

  test("authenticated user with progress sees belt level", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/");

    await expect(authenticatedPage.getByText(/^performance$/i)).toBeVisible();

    // Use regex to match belt level pattern (e.g., "Orange Belt - Level 8")
    await expect(authenticatedPage.getByText(/belt - level \d+/i)).toBeVisible();

    // Use regex to match BP to next level pattern
    await expect(authenticatedPage.getByText(/\d+ bp to next level/i)).toBeVisible();
  });

  test("authenticated user with progress sees score", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/");

    await expect(authenticatedPage.getByText(/^performance$/i)).toBeVisible();

    // Use regex to match any percentage of correct answers (e.g., "75%" or "75.2%")
    await expect(authenticatedPage.getByText(/\d+(\.\d+)?% correct answers/i)).toBeVisible();
  });

  test("authenticated user with progress sees best day", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/");

    await expect(authenticatedPage.getByText(/^performance$/i)).toBeVisible();
    await expect(authenticatedPage.getByText(/best day/i)).toBeVisible();

    // Use regex to match any day of week with percentage (e.g., "Sunday with 76.1%")
    await expect(
      authenticatedPage.getByText(
        /(monday|tuesday|wednesday|thursday|friday|saturday|sunday) with \d+(\.\d+)?%/i,
      ),
    ).toBeVisible();
  });

  test("authenticated user with progress sees best time", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/");

    await expect(authenticatedPage.getByText(/^performance$/i)).toBeVisible();
    await expect(authenticatedPage.getByText(/best time/i)).toBeVisible();

    // Use regex to match time period with percentage (e.g., "Morning with 90%")
    await expect(
      authenticatedPage.getByText(/(morning|afternoon|evening|night) with \d+%/i),
    ).toBeVisible();
  });

  test("user without progress does not see performance section", async ({
    userWithoutProgress,
  }) => {
    await userWithoutProgress.goto("/");

    await expect(userWithoutProgress.getByText(/^performance$/i)).not.toBeVisible();
  });
});

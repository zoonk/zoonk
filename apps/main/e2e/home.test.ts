import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { userProgressFixture } from "@zoonk/testing/fixtures/progress";
import { expect, test } from "./fixtures";

test.describe("Home Page - Unauthenticated", () => {
  test("shows hero with CTAs that navigate to correct pages", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/continue learning/iu)).not.toBeVisible();

    const hero = page.getByRole("main");

    await expect(hero.getByRole("heading", { name: /change your life/iu })).toBeVisible();

    const startFreeLink = hero.getByRole("link", { name: "Start free" });

    await expect(startFreeLink).toHaveAttribute("href", "/learn");

    await expect(
      hero.getByRole("link", { name: "Log in to save your progress" }),
    ).not.toBeVisible();

    await startFreeLink.click();

    await expect(page).toHaveURL(/\/learn$/u);
    await expect(page.getByRole("heading", { name: /learn anything/iu })).toBeVisible();
  });

  test("does not show progress section", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/^progress$/iu)).not.toBeVisible();
  });
});

test.describe("Home Page - Authenticated", () => {
  test("continue learning lesson description navigates to the player", async ({
    baseURL,
    browser,
  }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const [org, user] = await Promise.all([getAiOrganization(), createE2EUser(baseURL!)]);

    const course = await courseFixture({
      isPublished: true,
      organizationId: org.id,
      slug: `e2e-description-course-${uniqueId}`,
      title: `E2E Description Course ${uniqueId}`,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: org.id,
      slug: `e2e-description-chapter-${uniqueId}`,
      title: `E2E Description Chapter ${uniqueId}`,
    });

    const lessonDescription = `E2E Description target ${uniqueId}`;

    const [completedLesson, nextLesson] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: org.id,
        position: 0,
        slug: `e2e-description-completed-${uniqueId}`,
        title: `E2E Description Completed ${uniqueId}`,
      }),
      lessonFixture({
        chapterId: chapter.id,
        description: lessonDescription,
        generationStatus: "completed",
        isPublished: true,
        organizationId: org.id,
        position: 1,
        slug: `e2e-description-next-${uniqueId}`,
        title: `E2E Description Next ${uniqueId}`,
      }),
    ]);

    await Promise.all([
      lessonProgressFixture({
        completedAt: new Date(),
        durationSeconds: 60,
        lessonId: completedLesson.id,
        userId: user.id,
      }),
      userProgressFixture({ totalBrainPower: 100n, userId: user.id }),
      prisma.courseUser.create({ data: { courseId: course.id, userId: user.id } }),
    ]);

    const ctx = await browser.newContext({ storageState: user.storageState });
    const page = await ctx.newPage();

    try {
      await page.goto("/");

      const descriptionLink = page.getByRole("link", { name: lessonDescription });

      await expect(descriptionLink).toBeVisible();
      await descriptionLink.click();

      await expect(page).toHaveURL(
        new RegExp(`/b/${org.slug}/c/${course.slug}/ch/${chapter.slug}/l/${nextLesson.slug}$`, "u"),
      );
    } finally {
      await ctx.close();
    }
  });

  test("user with progress sees continue learning instead of hero", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/");

    // Use .first() to handle potential duplicates during streaming/hydration
    await expect(
      authenticatedPage.getByRole("heading", { name: /continue learning/iu }).first(),
    ).toBeVisible();

    await expect(
      authenticatedPage.getByRole("heading", { name: /change your life/iu }),
    ).not.toBeVisible();
  });

  test("user without progress sees hero section", async ({ userWithoutProgress }) => {
    await userWithoutProgress.goto("/");

    await expect(userWithoutProgress.getByText(/continue learning/iu)).not.toBeVisible();

    await expect(
      userWithoutProgress.getByRole("heading", { name: /change your life/iu }),
    ).toBeVisible();

    await expect(userWithoutProgress.getByRole("link", { name: "Start free" })).toBeVisible();

    await expect(
      userWithoutProgress.getByRole("link", { name: "Log in to save your progress" }),
    ).not.toBeVisible();
  });

  test("shows pending course when next lesson has no generated lessons", async ({
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
      title: `E2E Pending Chapter ${uniqueId}`,
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

    const lesson = await lessonFixture({
      generationStatus: "completed",
      isPublished: true,
      lessonId: lesson1.id,
      organizationId: org.id,
      position: 0,
    });

    await Promise.all([
      lessonProgressFixture({
        completedAt: new Date(),
        durationSeconds: 60,
        lessonId: lesson.id,
        userId: user.id,
      }),
      userProgressFixture({ totalBrainPower: 100n, userId: user.id }),
      prisma.courseUser.create({ data: { courseId: course.id, userId: user.id } }),
    ]);

    const ctx = await browser.newContext({ storageState: user.storageState });
    const page = await ctx.newPage();

    await page.goto("/");

    await expect(page.getByRole("heading", { name: /continue learning/iu }).first()).toBeVisible();

    await expect(page.getByRole("heading", { name: /change your life/iu })).not.toBeVisible();

    await expect(
      page.getByRole("link", { name: new RegExp(`Next:.*E2E Pending Lesson ${uniqueId}`, "u") }),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: `E2E Pending Chapter ${uniqueId}` })).toBeVisible();
    await expect(page.getByRole("link", { name: `E2E Pending Course ${uniqueId}` })).toBeVisible();
    await expect(page.getByText(`E2E Pending Lesson Description ${uniqueId}`)).toBeVisible();

    await ctx.close();
  });
});

test.describe("Home Page - Progress Section", () => {
  test("authenticated user with progress sees energy level", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/");

    // Wait for Suspense content to load - Progress section only renders when data is available
    await expect(authenticatedPage.getByText(/^progress$/iu)).toBeVisible();

    // Use regex to match "Your energy is X%" where X can be any number (including decimals)
    await expect(authenticatedPage.getByText(/your energy is \d+(?:\.\d+)?%/iu)).toBeVisible();
  });

  test("authenticated user with progress sees belt level", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/");

    await expect(authenticatedPage.getByText(/^progress$/iu)).toBeVisible();

    // Use regex to match belt level pattern (e.g., "Orange Belt - Level 8")
    await expect(authenticatedPage.getByText(/belt - level \d+/iu)).toBeVisible();

    // Use regex to match BP to next level pattern
    await expect(authenticatedPage.getByText(/\d+ bp to next level/iu)).toBeVisible();
  });

  test("authenticated user with progress sees learning totals after level", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/");

    const progressSection = authenticatedPage.getByRole("region", { name: /^progress$/iu });

    await expect(progressSection).toBeVisible();

    const progressCards = progressSection.getByRole("article");
    await expect(progressCards.nth(1)).toContainText(/belt - level \d+/iu);

    const learningDaysCard = progressSection.getByRole("article", { name: /learning days/iu });

    await expect(learningDaysCard).toContainText("1 day");

    await expect(learningDaysCard).toContainText("At least one completed lesson");

    const learningTimeCard = progressSection.getByRole("article", { name: /learning time/iu });

    await expect(learningTimeCard).toContainText("2 min");
    await expect(learningTimeCard).toContainText("Time spent in lessons");
  });

  test("authenticated user with progress sees score", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/");

    await expect(authenticatedPage.getByText(/^progress$/iu)).toBeVisible();

    // Use regex to match any percentage of correct answers (e.g., "75%" or "75.2%")
    await expect(authenticatedPage.getByText(/\d+(?:\.\d+)?% correct answers/iu)).toBeVisible();
  });

  test("authenticated user with progress sees best day", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/");

    await expect(authenticatedPage.getByText(/^progress$/iu)).toBeVisible();
    await expect(authenticatedPage.getByText(/best day/iu)).toBeVisible();

    // Use regex to match any day of week with percentage (e.g., "Sunday with 76.1%")
    await expect(
      authenticatedPage.getByText(
        /(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday) with \d+(?:\.\d+)?%/iu,
      ),
    ).toBeVisible();
  });

  test("authenticated user with progress sees best time", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/");

    await expect(authenticatedPage.getByText(/^progress$/iu)).toBeVisible();
    await expect(authenticatedPage.getByText(/best time/iu)).toBeVisible();

    // Use regex to match time period with percentage (e.g., "Morning with 90%")
    await expect(
      authenticatedPage.getByText(/(?:morning|afternoon|evening|night) with \d+%/iu),
    ).toBeVisible();
  });

  test("user without progress does not see progress section", async ({ userWithoutProgress }) => {
    await userWithoutProgress.goto("/");

    await expect(userWithoutProgress.getByText(/^progress$/iu)).not.toBeVisible();
  });
});

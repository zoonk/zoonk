import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { expect, test } from "./fixtures";

async function createTestHierarchy(prefix: string) {
  const org = await prisma.organization.findUniqueOrThrow({ where: { slug: "ai" } });
  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-${prefix}-course-${uniqueId}`,
    title: `E2E ${prefix} Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-${prefix}-chapter-${uniqueId}`,
    title: `E2E ${prefix} Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    description: `E2E ${prefix} lesson ${uniqueId}`,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-${prefix}-lesson-${uniqueId}`,
    title: `E2E ${prefix} Lesson ${uniqueId}`,
  });

  const buildUrl = () => `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/0`;

  return { buildUrl, lesson, org, uniqueId };
}

test.describe("Activity Completion", () => {
  test("authenticated user sees real BP and energy badges on quiz completion", async ({
    authenticatedPage,
  }) => {
    const { buildUrl, lesson, org, uniqueId } = await createTestHierarchy("compl");

    const activity = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "quiz",
      lessonId: lesson.id,
      organizationId: org.id,
      position: 0,
    });

    await stepFixture({
      activityId: activity.id,
      content: {
        kind: "core",
        options: [
          { feedback: "Correct!", isCorrect: true, text: `Right ${uniqueId}` },
          { feedback: "Wrong", isCorrect: false, text: `Wrong ${uniqueId}` },
        ],
        question: `Question ${uniqueId}`,
      },
      isPublished: true,
      kind: "multipleChoice",
    });

    await authenticatedPage.goto(buildUrl());
    await authenticatedPage.waitForLoadState("networkidle");

    await authenticatedPage.getByRole("radio", { name: new RegExp(`Right ${uniqueId}`) }).click();
    await authenticatedPage.getByRole("button", { name: /check/i }).click();
    await authenticatedPage.getByRole("button", { name: /continue/i }).click();

    await expect(authenticatedPage.getByText("+10 BP")).toBeVisible();
    await expect(authenticatedPage.getByText(/BP to next level/i)).toBeVisible();
  });

  test("guest user sees login prompt, no reward badges", async ({ page }) => {
    const { buildUrl, lesson, org, uniqueId } = await createTestHierarchy("guest");

    const activity = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "quiz",
      lessonId: lesson.id,
      organizationId: org.id,
      position: 0,
    });

    await stepFixture({
      activityId: activity.id,
      content: {
        kind: "core",
        options: [
          { feedback: "Correct!", isCorrect: true, text: `Right ${uniqueId}` },
          { feedback: "Wrong", isCorrect: false, text: `Wrong ${uniqueId}` },
        ],
        question: `Question ${uniqueId}`,
      },
      isPublished: true,
      kind: "multipleChoice",
    });

    await page.goto(buildUrl());
    await page.waitForLoadState("networkidle");

    await page.getByRole("radio", { name: new RegExp(`Right ${uniqueId}`) }).click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    await expect(page.getByText(/sign up to track your progress/i)).toBeVisible();
    await expect(page.getByText(/BP to next level/i)).not.toBeVisible();
  });

  test("challenge success shows +100 BP badge", async ({ authenticatedPage }) => {
    const { buildUrl, lesson, org, uniqueId } = await createTestHierarchy("chsuc");
    const dim = `Valor ${uniqueId}`;

    const activity = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "challenge",
      lessonId: lesson.id,
      organizationId: org.id,
      position: 0,
    });

    await stepFixture({
      activityId: activity.id,
      content: {
        context: `Challenge context ${uniqueId}`,
        kind: "challenge",
        options: [
          {
            consequence: `Great choice ${uniqueId}`,
            effects: [{ dimension: dim, impact: "positive" }],
            text: `Good ${uniqueId}`,
          },
          {
            consequence: "Bad choice",
            effects: [{ dimension: dim, impact: "negative" }],
            text: "Bad",
          },
        ],
        question: `Challenge Q ${uniqueId}`,
      },
      isPublished: true,
      kind: "multipleChoice",
    });

    await authenticatedPage.goto(buildUrl());
    await authenticatedPage.getByRole("button", { name: /begin/i }).click();
    await authenticatedPage.waitForLoadState("networkidle");

    await authenticatedPage.getByRole("radio", { name: new RegExp(`Good ${uniqueId}`) }).click();
    await authenticatedPage.getByRole("button", { name: /check/i }).click();
    await authenticatedPage.getByRole("button", { name: /continue/i }).click();

    await expect(authenticatedPage.getByText(/challenge complete/i)).toBeVisible();
    await expect(authenticatedPage.getByText("+100 BP")).toBeVisible();
  });

  test("challenge failure shows Challenge Failed and +10 BP", async ({ authenticatedPage }) => {
    const { buildUrl, lesson, org, uniqueId } = await createTestHierarchy("chfail");
    const dim = `Honor ${uniqueId}`;

    const activity = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "challenge",
      lessonId: lesson.id,
      organizationId: org.id,
      position: 0,
    });

    await stepFixture({
      activityId: activity.id,
      content: {
        context: `Challenge fail ${uniqueId}`,
        kind: "challenge",
        options: [
          {
            consequence: "Good",
            effects: [{ dimension: dim, impact: "positive" }],
            text: "Good choice",
          },
          {
            consequence: `Bad outcome ${uniqueId}`,
            effects: [{ dimension: dim, impact: "negative" }],
            text: `Bad ${uniqueId}`,
          },
        ],
        question: `Fail Q ${uniqueId}`,
      },
      isPublished: true,
      kind: "multipleChoice",
    });

    await authenticatedPage.goto(buildUrl());
    await authenticatedPage.getByRole("button", { name: /begin/i }).click();
    await authenticatedPage.waitForLoadState("networkidle");

    await authenticatedPage.getByRole("radio", { name: new RegExp(`Bad ${uniqueId}`) }).click();
    await authenticatedPage.getByRole("button", { name: /check/i }).click();
    await authenticatedPage.getByRole("button", { name: /continue/i }).click();

    await expect(authenticatedPage.getByText(/challenge failed/i)).toBeVisible();
    await expect(authenticatedPage.getByText("+10 BP")).toBeVisible();
  });
});

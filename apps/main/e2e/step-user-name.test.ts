import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { expect, test } from "./fixtures";

async function createActivityWithNamePlaceholder(options: {
  steps: { content: object; position: number }[];
}) {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: "ai" },
  });

  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-name-course-${uniqueId}`,
    title: `E2E Name Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-name-chapter-${uniqueId}`,
    title: `E2E Name Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    description: `E2E name lesson ${uniqueId}`,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-name-lesson-${uniqueId}`,
    title: `E2E Name Lesson ${uniqueId}`,
  });

  const activity = await activityFixture({
    generationStatus: "completed",
    isPublished: true,
    kind: "background",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 0,
    title: `E2E Name Activity ${uniqueId}`,
  });

  await Promise.all(
    options.steps.map((step) =>
      stepFixture({
        activityId: activity.id,
        content: step.content,
        isPublished: true,
        kind: "multipleChoice",
        position: step.position,
      }),
    ),
  );

  const url = `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/0`;

  return { uniqueId, url };
}

test.describe("Name placeholder replacement", () => {
  test("unauthenticated user sees clean text without {{NAME}}", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createActivityWithNamePlaceholder({
      steps: [
        {
          content: {
            context: `{{NAME}}, I think we have a problem ${uniqueId}`,
            kind: "core",
            options: [
              { feedback: "Yes", isCorrect: true, text: "Option A" },
              { feedback: "No", isCorrect: false, text: "Option B" },
            ],
            question: `What do you think ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);

    await expect(page.getByText(new RegExp(`I think we have a problem ${uniqueId}`))).toBeVisible();
    await expect(page.getByText("{{NAME}}")).not.toBeVisible();
  });

  test("authenticated user sees their display name instead of {{NAME}}", async ({
    authenticatedPage,
  }) => {
    const uniqueId = randomUUID().slice(0, 8);

    const { url } = await createActivityWithNamePlaceholder({
      steps: [
        {
          content: {
            context: `{{NAME}}, I think we have a problem ${uniqueId}`,
            kind: "core",
            options: [
              { feedback: "Yes", isCorrect: true, text: "Option A" },
              { feedback: "No", isCorrect: false, text: "Option B" },
            ],
            question: `What do you think ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await authenticatedPage.goto(url);

    // Verify {{NAME}} was replaced with a real name (not stripped).
    // Stripped version: "I think we have a problem {id}" (no comma prefix).
    // Replaced version: "SomeName, I think we have a problem {id}" (has comma prefix).
    await expect(
      authenticatedPage.getByText(new RegExp(`.+, I think we have a problem ${uniqueId}`)),
    ).toBeVisible();
    await expect(authenticatedPage.getByText("{{NAME}}")).not.toBeVisible();
  });

  test("feedback text replaces {{NAME}} for authenticated user", async ({ authenticatedPage }) => {
    const uniqueId = randomUUID().slice(0, 8);

    const { url } = await createActivityWithNamePlaceholder({
      steps: [
        {
          content: {
            kind: "core",
            options: [
              {
                feedback: `{{NAME}}, great job ${uniqueId}`,
                isCorrect: true,
                text: "Correct answer",
              },
              { feedback: "Try again", isCorrect: false, text: "Wrong answer" },
            ],
            question: `Test question ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await authenticatedPage.goto(url);
    await authenticatedPage.waitForLoadState("networkidle");

    await authenticatedPage.getByRole("radio", { name: /correct answer/i }).click();
    await authenticatedPage.getByRole("button", { name: /check/i }).click();

    // Verify {{NAME}} was replaced with a real name (not stripped).
    // Stripped version: "great job {id}" (no comma prefix).
    // Replaced version: "SomeName, great job {id}" (has comma prefix).
    await expect(
      authenticatedPage.getByText(new RegExp(`.+, great job ${uniqueId}`)),
    ).toBeVisible();
    await expect(authenticatedPage.getByText("{{NAME}}")).not.toBeVisible();
  });

  test("feedback text strips {{NAME}} for unauthenticated user", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createActivityWithNamePlaceholder({
      steps: [
        {
          content: {
            kind: "core",
            options: [
              {
                feedback: `{{NAME}}, great job ${uniqueId}`,
                isCorrect: true,
                text: "Correct answer",
              },
              { feedback: "Try again", isCorrect: false, text: "Wrong answer" },
            ],
            question: `Test question ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.getByRole("radio", { name: /correct answer/i }).click();
    await page.getByRole("button", { name: /check/i }).click();

    await expect(page.getByText(new RegExp(`great job ${uniqueId}`))).toBeVisible();
    await expect(page.getByText("{{NAME}}")).not.toBeVisible();
  });
});

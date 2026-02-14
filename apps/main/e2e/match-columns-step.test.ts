import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { expect, test } from "./fixtures";

async function createMatchColumnsActivity(options: {
  steps: { content: object; position: number }[];
}) {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: "ai" },
  });

  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-mc-course-${uniqueId}`,
    title: `E2E MC Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-mc-chapter-${uniqueId}`,
    title: `E2E MC Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    description: `E2E mc lesson ${uniqueId}`,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-mc-lesson-${uniqueId}`,
    title: `E2E MC Lesson ${uniqueId}`,
  });

  const activity = await activityFixture({
    generationStatus: "completed",
    isPublished: true,
    kind: "background",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 0,
    title: `E2E MC Activity ${uniqueId}`,
  });

  await Promise.all(
    options.steps.map((step) =>
      stepFixture({
        activityId: activity.id,
        content: step.content,
        isPublished: true,
        kind: "matchColumns",
        position: step.position,
      }),
    ),
  );

  const url = `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/0`;

  return { activity, chapter, course, lesson, uniqueId, url };
}

test.describe("Match Columns Step", () => {
  test("renders question and items in aligned rows", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createMatchColumnsActivity({
      steps: [
        {
          content: {
            pairs: [
              { left: `Sun ${uniqueId}`, right: `Star ${uniqueId}` },
              { left: `Moon ${uniqueId}`, right: `Satellite ${uniqueId}` },
            ],
            question: `Match the pairs ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);

    await expect(page.getByText(new RegExp(`Match the pairs ${uniqueId}`))).toBeVisible();
    await expect(page.getByRole("button", { name: `Sun ${uniqueId}` })).toBeVisible();
    await expect(page.getByRole("button", { name: `Moon ${uniqueId}` })).toBeVisible();
  });

  test("tapping left item highlights it", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createMatchColumnsActivity({
      steps: [
        {
          content: {
            pairs: [
              { left: `Cat ${uniqueId}`, right: `Meow ${uniqueId}` },
              { left: `Dog ${uniqueId}`, right: `Bark ${uniqueId}` },
            ],
            question: `Match sounds ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);

    const catButton = page.getByRole("button", { name: `Cat ${uniqueId}` });
    await catButton.click();
    await expect(catButton).toHaveAttribute("aria-pressed", "true");
  });

  test("correct match shows success state and locks pair", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createMatchColumnsActivity({
      steps: [
        {
          content: {
            pairs: [
              { left: `Apple ${uniqueId}`, right: `Fruit ${uniqueId}` },
              { left: `Carrot ${uniqueId}`, right: `Veggie ${uniqueId}` },
            ],
            question: `Match categories ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);

    await page.getByRole("button", { name: `Apple ${uniqueId}` }).click();
    await page.getByRole("button", { name: `Fruit ${uniqueId}` }).click();

    // Both items should be disabled (locked) after correct match
    await expect(page.getByRole("button", { name: `Apple ${uniqueId}` })).toBeDisabled();
    await expect(page.getByRole("button", { name: `Fruit ${uniqueId}` })).toBeDisabled();
  });

  test("incorrect match flashes error and auto-resets", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createMatchColumnsActivity({
      steps: [
        {
          content: {
            pairs: [
              { left: `Paris ${uniqueId}`, right: `France ${uniqueId}` },
              { left: `Tokyo ${uniqueId}`, right: `Japan ${uniqueId}` },
            ],
            question: `Match capitals ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);

    await page.getByRole("button", { name: `Paris ${uniqueId}` }).click();
    await page.getByRole("button", { name: `Japan ${uniqueId}` }).click();

    // After flash timeout, items should be back to interactive
    await expect(page.getByRole("button", { name: `Paris ${uniqueId}` })).toBeEnabled({
      timeout: 2000,
    });
    await expect(page.getByRole("button", { name: `Japan ${uniqueId}` })).toBeEnabled();
  });

  test("deselecting a left item", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createMatchColumnsActivity({
      steps: [
        {
          content: {
            pairs: [
              { left: `Hot ${uniqueId}`, right: `Cold ${uniqueId}` },
              { left: `Big ${uniqueId}`, right: `Small ${uniqueId}` },
            ],
            question: `Match opposites ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);

    const hotButton = page.getByRole("button", { name: `Hot ${uniqueId}` });

    await hotButton.click();
    await expect(hotButton).toHaveAttribute("aria-pressed", "true");

    await hotButton.click();
    await expect(hotButton).toHaveAttribute("aria-pressed", "false");
  });

  test("all correct matches enables Check button", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createMatchColumnsActivity({
      steps: [
        {
          content: {
            pairs: [
              { left: `A ${uniqueId}`, right: `1 ${uniqueId}` },
              { left: `B ${uniqueId}`, right: `2 ${uniqueId}` },
            ],
            question: `Match letters ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    const checkButton = page.getByRole("button", { name: /check/i });
    await expect(checkButton).toBeDisabled();

    // Match first pair correctly
    await page.getByRole("button", { name: `A ${uniqueId}` }).click();
    await page.getByRole("button", { name: `1 ${uniqueId}` }).click();

    // Still disabled — not all matched yet
    await expect(checkButton).toBeDisabled();

    // Match second pair correctly
    await page.getByRole("button", { name: `B ${uniqueId}` }).click();
    await page.getByRole("button", { name: `2 ${uniqueId}` }).click();

    await expect(checkButton).toBeEnabled();
  });

  test("skips feedback screen and advances to next step after Check", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createMatchColumnsActivity({
      steps: [
        {
          content: {
            pairs: [
              { left: `Red ${uniqueId}`, right: `Rouge ${uniqueId}` },
              { left: `Blue ${uniqueId}`, right: `Bleu ${uniqueId}` },
            ],
            question: `Match colors step 1 ${uniqueId}`,
          },
          position: 0,
        },
        {
          content: {
            pairs: [
              { left: `One ${uniqueId}`, right: `Uno ${uniqueId}` },
              { left: `Two ${uniqueId}`, right: `Dos ${uniqueId}` },
            ],
            question: `Match numbers step 2 ${uniqueId}`,
          },
          position: 1,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    // Complete first step
    await page.getByRole("button", { name: `Red ${uniqueId}` }).click();
    await page.getByRole("button", { name: `Rouge ${uniqueId}` }).click();

    await page.getByRole("button", { name: `Blue ${uniqueId}` }).click();
    await page.getByRole("button", { name: `Bleu ${uniqueId}` }).click();

    await page.getByRole("button", { name: /check/i }).click();

    // Should immediately show the second step's question — no feedback screen
    await expect(page.getByText(new RegExp(`Match numbers step 2 ${uniqueId}`))).toBeVisible();
  });

  test("making a mistake then correcting shows as incorrect on completion", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createMatchColumnsActivity({
      steps: [
        {
          content: {
            pairs: [
              { left: `H2O ${uniqueId}`, right: `Water ${uniqueId}` },
              { left: `NaCl ${uniqueId}`, right: `Salt ${uniqueId}` },
            ],
            question: `Match formulas ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    // Make an incorrect match first
    await page.getByRole("button", { name: `H2O ${uniqueId}` }).click();
    await page.getByRole("button", { name: `Salt ${uniqueId}` }).click();

    // Wait for flash to clear
    await expect(page.getByRole("button", { name: `H2O ${uniqueId}` })).toBeEnabled({
      timeout: 2000,
    });

    // Now match correctly
    await page.getByRole("button", { name: `H2O ${uniqueId}` }).click();
    await page.getByRole("button", { name: `Water ${uniqueId}` }).click();

    await page.getByRole("button", { name: `NaCl ${uniqueId}` }).click();
    await page.getByRole("button", { name: `Salt ${uniqueId}` }).click();

    // Check — auto-advances to completion (no feedback screen)
    await page.getByRole("button", { name: /check/i }).click();

    // Completion screen should show 0/1 (incorrect because of mistakes)
    await expect(page.getByText("0/1")).toBeVisible();
  });

  test("full flow with no mistakes shows correct on completion", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createMatchColumnsActivity({
      steps: [
        {
          content: {
            pairs: [
              { left: `Dog ${uniqueId}`, right: `Woof ${uniqueId}` },
              { left: `Cat ${uniqueId}`, right: `Meow ${uniqueId}` },
            ],
            question: `Match sounds ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: `Dog ${uniqueId}` }).click();
    await page.getByRole("button", { name: `Woof ${uniqueId}` }).click();

    await page.getByRole("button", { name: `Cat ${uniqueId}` }).click();
    await page.getByRole("button", { name: `Meow ${uniqueId}` }).click();

    // Check — auto-advances to completion (no feedback screen)
    await page.getByRole("button", { name: /check/i }).click();
    await expect(page.getByText("1/1")).toBeVisible();
    await expect(page.getByText(/correct/i)).toBeVisible();
  });
});

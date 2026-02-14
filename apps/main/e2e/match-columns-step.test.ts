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
  test("renders question and both columns", async ({ page }) => {
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

    const leftColumn = page.getByRole("group", { name: /left column/i });
    await expect(leftColumn.getByRole("button", { name: `Sun ${uniqueId}` })).toBeVisible();
    await expect(leftColumn.getByRole("button", { name: `Moon ${uniqueId}` })).toBeVisible();

    const rightColumn = page.getByRole("group", { name: /right column/i });
    await expect(rightColumn.getByRole("button", { name: `Star ${uniqueId}` })).toBeVisible();
    await expect(rightColumn.getByRole("button", { name: `Satellite ${uniqueId}` })).toBeVisible();
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

    const leftColumn = page.getByRole("group", { name: /left column/i });
    const catButton = leftColumn.getByRole("button", { name: `Cat ${uniqueId}` });

    await catButton.click();

    await expect(catButton).toHaveAttribute("aria-pressed", "true");
  });

  test("tapping right item after selecting left creates a match", async ({ page }) => {
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

    const leftColumn = page.getByRole("group", { name: /left column/i });
    const rightColumn = page.getByRole("group", { name: /right column/i });

    await leftColumn.getByRole("button", { name: `Apple ${uniqueId}` }).click();
    await rightColumn.getByRole("button", { name: `Fruit ${uniqueId}` }).click();

    await expect(
      leftColumn.getByRole("button", {
        name: new RegExp(`Apple ${uniqueId}.*matched.*Fruit ${uniqueId}`),
      }),
    ).toBeVisible();
  });

  test("tapping a matched pair unmatches it", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createMatchColumnsActivity({
      steps: [
        {
          content: {
            pairs: [
              { left: `Red ${uniqueId}`, right: `Color ${uniqueId}` },
              { left: `Three ${uniqueId}`, right: `Number ${uniqueId}` },
            ],
            question: `Match types ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);

    const leftColumn = page.getByRole("group", { name: /left column/i });
    const rightColumn = page.getByRole("group", { name: /right column/i });

    await leftColumn.getByRole("button", { name: `Red ${uniqueId}` }).click();
    await rightColumn.getByRole("button", { name: `Color ${uniqueId}` }).click();

    // Tap the matched left item to unmatch
    await leftColumn.getByRole("button", { name: new RegExp(`Red ${uniqueId}.*matched`) }).click();

    // Should be back to unmatched state
    await expect(leftColumn.getByRole("button", { name: `Red ${uniqueId}` })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
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

    const leftColumn = page.getByRole("group", { name: /left column/i });
    const hotButton = leftColumn.getByRole("button", { name: `Hot ${uniqueId}` });

    await hotButton.click();
    await expect(hotButton).toHaveAttribute("aria-pressed", "true");

    await hotButton.click();
    await expect(hotButton).toHaveAttribute("aria-pressed", "false");
  });

  test("check button disabled until all pairs matched", async ({ page }) => {
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

    const leftColumn = page.getByRole("group", { name: /left column/i });
    const rightColumn = page.getByRole("group", { name: /right column/i });

    await leftColumn.getByRole("button", { name: `A ${uniqueId}` }).click();
    await rightColumn.getByRole("button", { name: `1 ${uniqueId}` }).click();

    await expect(checkButton).toBeDisabled();

    await leftColumn.getByRole("button", { name: `B ${uniqueId}` }).click();
    await rightColumn.getByRole("button", { name: `2 ${uniqueId}` }).click();

    await expect(checkButton).toBeEnabled();
  });

  test("correct answer shows Correct! feedback", async ({ page }) => {
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

    const leftColumn = page.getByRole("group", { name: /left column/i });
    const rightColumn = page.getByRole("group", { name: /right column/i });

    await leftColumn.getByRole("button", { name: `H2O ${uniqueId}` }).click();
    await rightColumn.getByRole("button", { name: `Water ${uniqueId}` }).click();

    await leftColumn.getByRole("button", { name: `NaCl ${uniqueId}` }).click();
    await rightColumn.getByRole("button", { name: `Salt ${uniqueId}` }).click();

    await page.getByRole("button", { name: /check/i }).click();

    await expect(page.getByText(/correct!/i)).toBeVisible();
  });

  test("incorrect answer shows Not quite feedback", async ({ page }) => {
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
    await page.waitForLoadState("networkidle");

    const leftColumn = page.getByRole("group", { name: /left column/i });
    const rightColumn = page.getByRole("group", { name: /right column/i });

    // Match incorrectly: Paris → Japan, Tokyo → France
    await leftColumn.getByRole("button", { name: `Paris ${uniqueId}` }).click();
    await rightColumn.getByRole("button", { name: `Japan ${uniqueId}` }).click();

    await leftColumn.getByRole("button", { name: `Tokyo ${uniqueId}` }).click();
    await rightColumn.getByRole("button", { name: `France ${uniqueId}` }).click();

    await page.getByRole("button", { name: /check/i }).click();

    await expect(page.getByText(/not quite/i)).toBeVisible();
  });

  test("full flow: match all, check, continue, completion", async ({ page }) => {
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

    const leftColumn = page.getByRole("group", { name: /left column/i });
    const rightColumn = page.getByRole("group", { name: /right column/i });

    await leftColumn.getByRole("button", { name: `Dog ${uniqueId}` }).click();
    await rightColumn.getByRole("button", { name: `Woof ${uniqueId}` }).click();

    await leftColumn.getByRole("button", { name: `Cat ${uniqueId}` }).click();
    await rightColumn.getByRole("button", { name: `Meow ${uniqueId}` }).click();

    await page.getByRole("button", { name: /check/i }).click();
    await expect(page.getByText(/correct!/i)).toBeVisible();

    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByText("1/1")).toBeVisible();
    await expect(page.getByText(/correct/i)).toBeVisible();
  });
});

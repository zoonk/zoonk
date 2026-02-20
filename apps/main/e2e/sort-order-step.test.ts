import { randomUUID } from "node:crypto";
import { getAiOrganization } from "@zoonk/e2e/helpers";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { expect, test } from "./fixtures";

async function createSortOrderActivity(options: {
  steps: { content: object; position: number }[];
}) {
  const org = await getAiOrganization();

  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-so-course-${uniqueId}`,
    title: `E2E SO Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-so-chapter-${uniqueId}`,
    title: `E2E SO Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    description: `E2E so lesson ${uniqueId}`,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-so-lesson-${uniqueId}`,
    title: `E2E SO Lesson ${uniqueId}`,
  });

  const activity = await activityFixture({
    generationStatus: "completed",
    isPublished: true,
    kind: "background",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 0,
    title: `E2E SO Activity ${uniqueId}`,
  });

  await Promise.all(
    options.steps.map((step) =>
      stepFixture({
        activityId: activity.id,
        content: step.content,
        isPublished: true,
        kind: "sortOrder",
        position: step.position,
      }),
    ),
  );

  const url = `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/0`;

  return { activity, chapter, course, lesson, uniqueId, url };
}

test.describe("Sort Order Step", () => {
  test("renders question, instruction text, and all items", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createSortOrderActivity({
      steps: [
        {
          content: {
            feedback: `Great ${uniqueId}`,
            items: [`First ${uniqueId}`, `Second ${uniqueId}`, `Third ${uniqueId}`],
            question: `Sort these items ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);

    await expect(page.getByText(new RegExp(`Sort these items ${uniqueId}`))).toBeVisible();
    await expect(page.getByText(/drag items into the correct order/i)).toBeVisible();

    const itemList = page.getByRole("list", { name: /sort items/i });

    await expect(itemList.getByText(new RegExp(`First ${uniqueId}`))).toBeVisible();
    await expect(itemList.getByText(new RegExp(`Second ${uniqueId}`))).toBeVisible();
    await expect(itemList.getByText(new RegExp(`Third ${uniqueId}`))).toBeVisible();
  });

  test("check button is always enabled and items have position numbers", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createSortOrderActivity({
      steps: [
        {
          content: {
            feedback: `Feedback ${uniqueId}`,
            items: [`Alpha ${uniqueId}`, `Beta ${uniqueId}`],
            question: `Order ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);

    const itemList = page.getByRole("list", { name: /sort items/i });
    const items = itemList.getByRole("listitem");

    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText("1");
    await expect(items.nth(1)).toContainText("2");

    await expect(async () => {
      await expect(page.getByRole("button", { name: /check/i })).toBeEnabled({ timeout: 1000 });
    }).toPass();
  });

  test("drag swaps adjacent items", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createSortOrderActivity({
      steps: [
        {
          content: {
            feedback: `Feedback ${uniqueId}`,
            items: [`One ${uniqueId}`, `Two ${uniqueId}`, `Three ${uniqueId}`],
            question: `Order ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);

    const itemList = page.getByRole("list", { name: /sort items/i });
    await expect(itemList.getByRole("listitem")).toHaveCount(3);

    // Wait for hydration
    await expect(page.getByRole("button", { name: /check/i })).toBeEnabled();

    const buttons = itemList.getByRole("button");
    const initialFirstText = await buttons.nth(0).textContent();

    // Drag-and-drop can be timing-sensitive — retry the drag + assertion
    await expect(async () => {
      await buttons.nth(1).dragTo(buttons.nth(0), { steps: 10 });
      const newFirstText = await buttons.nth(0).textContent();
      expect(newFirstText).not.toBe(initialFirstText);
    }).toPass({ timeout: 10_000 });
  });

  test("checking answer shows feedback and continue button", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createSortOrderActivity({
      steps: [
        {
          content: {
            feedback: `Nice work ${uniqueId}`,
            items: [`A ${uniqueId}`, `B ${uniqueId}`, `C ${uniqueId}`],
            question: `Sort ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);

    // Wait for hydration
    await expect(page.getByRole("button", { name: /check/i })).toBeEnabled();

    await page.getByRole("button", { name: /check/i }).click();

    // Either "Correct!" or "Not quite" appears (depends on shuffle)
    await expect(page.getByText(/correct!|not quite/i)).toBeVisible();

    // Custom feedback always shows
    await expect(page.getByText(new RegExp(`Nice work ${uniqueId}`))).toBeVisible();

    // Continue button appears
    await expect(page.getByRole("button", { name: /continue/i })).toBeVisible();
  });

  test("incorrect answer shows 'Correct order:' label", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    // 7 items = 1/5040 chance of correct shuffle, virtually guaranteed wrong
    const { url } = await createSortOrderActivity({
      steps: [
        {
          content: {
            feedback: `Try again ${uniqueId}`,
            items: [
              `Item1 ${uniqueId}`,
              `Item2 ${uniqueId}`,
              `Item3 ${uniqueId}`,
              `Item4 ${uniqueId}`,
              `Item5 ${uniqueId}`,
              `Item6 ${uniqueId}`,
              `Item7 ${uniqueId}`,
            ],
            question: `Order ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);

    // Submit shuffled order as-is (virtually guaranteed incorrect with 7 items)
    await expect(page.getByRole("button", { name: /check/i })).toBeEnabled();
    await page.getByRole("button", { name: /check/i }).click();

    await expect(page.getByText(/not quite/i)).toBeVisible();
    await expect(page.getByText(/correct order:/i)).toBeVisible();
    await expect(page.getByText(new RegExp(`Try again ${uniqueId}`))).toBeVisible();
  });

  test("full flow: check, feedback, continue, completion", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createSortOrderActivity({
      steps: [
        {
          content: {
            feedback: `Done ${uniqueId}`,
            items: [`A ${uniqueId}`, `B ${uniqueId}`, `C ${uniqueId}`],
            question: `Sort ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);

    await expect(page.getByRole("button", { name: /check/i })).toBeEnabled();
    await page.getByRole("button", { name: /check/i }).click();

    await expect(page.getByText(new RegExp(`Done ${uniqueId}`))).toBeVisible();
    await page.getByRole("button", { name: /continue/i }).click();

    // Verify completion screen appears (score depends on shuffle)
    await expect(page.getByText(/correct/i)).toBeVisible();
  });
});

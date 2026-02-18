import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { expect, test } from "./fixtures";

async function createSortOrderActivity(options: {
  steps: { content: object; position: number }[];
}) {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: "ai" },
  });

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
  test("renders question, instruction text, and all items pre-placed", async ({ page }) => {
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
    await expect(page.getByText(/tap arrows to reorder/i)).toBeVisible();

    const itemList = page.getByRole("list", { name: /sort items/i });
    await expect(itemList).toBeVisible();

    await expect(itemList.getByText(new RegExp(`First ${uniqueId}`))).toBeVisible();
    await expect(itemList.getByText(new RegExp(`Second ${uniqueId}`))).toBeVisible();
    await expect(itemList.getByText(new RegExp(`Third ${uniqueId}`))).toBeVisible();
  });

  test("check button enabled from start", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createSortOrderActivity({
      steps: [
        {
          content: {
            feedback: `Feedback ${uniqueId}`,
            items: [`X ${uniqueId}`, `Y ${uniqueId}`],
            question: `Order ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);

    const checkButton = page.getByRole("button", { name: /check/i });
    await expect(checkButton).toBeEnabled();
  });

  test("tapping arrow reorders the list", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createSortOrderActivity({
      steps: [
        {
          content: {
            feedback: `Feedback ${uniqueId}`,
            items: [`Alpha ${uniqueId}`, `Beta ${uniqueId}`, `Gamma ${uniqueId}`],
            question: `Order ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);

    const itemList = page.getByRole("list", { name: /sort items/i });

    // Wait for hydration
    await expect(page.getByRole("button", { name: /check/i })).toBeEnabled();

    // Read initial first item
    const initialFirstText = await itemList
      .getByRole("listitem")
      .nth(0)
      .getByText(new RegExp(uniqueId))
      .innerText();

    // Move first item down
    await page
      .getByRole("button", { name: new RegExp(`move ${initialFirstText} down`, "i") })
      .click();

    // After move, the first position should have a different item
    const newFirstText = await itemList
      .getByRole("listitem")
      .nth(0)
      .getByText(new RegExp(uniqueId))
      .innerText();

    expect(newFirstText).not.toBe(initialFirstText);
  });

  test("correct answer shows Correct! text and green indicators", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createSortOrderActivity({
      steps: [
        {
          content: {
            feedback: `Well done ${uniqueId}`,
            items: [`Step1 ${uniqueId}`, `Step2 ${uniqueId}`],
            question: `Order correctly ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);

    const itemList = page.getByRole("list", { name: /sort items/i });

    // Wait for hydration
    await expect(page.getByRole("button", { name: /check/i })).toBeEnabled();

    // Read current first item to determine if we need to reorder
    const firstItemText = await itemList
      .getByRole("listitem")
      .nth(0)
      .getByText(new RegExp(uniqueId))
      .innerText();

    // If Step1 is not first, move it up (Step2 must be first, so move Step1 which is second up)
    if (!firstItemText.startsWith("Step1")) {
      await page
        .getByRole("button", { name: new RegExp(`move Step1 ${uniqueId} up`, "i") })
        .click();
    }

    await page.getByRole("button", { name: /check/i }).click();
    await expect(page.getByText(/correct!/i)).toBeVisible();
    await expect(page.getByText(new RegExp(`Well done ${uniqueId}`))).toBeVisible();

    // Items show correct result state
    await expect(
      itemList.getByRole("listitem", { name: new RegExp(`Step1 ${uniqueId}.*Correct`) }),
    ).toBeVisible();
    await expect(
      itemList.getByRole("listitem", { name: new RegExp(`Step2 ${uniqueId}.*Correct`) }),
    ).toBeVisible();

    // Correct order summary should NOT appear on correct answer
    await expect(page.getByText(/correct order:/i)).not.toBeVisible();
  });

  test("incorrect answer shows inline corrections with 'you had' annotations", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createSortOrderActivity({
      steps: [
        {
          content: {
            feedback: `Try again ${uniqueId}`,
            items: [`First ${uniqueId}`, `Second ${uniqueId}`],
            question: `Order ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);

    const itemList = page.getByRole("list", { name: /sort items/i });

    // Wait for hydration
    await expect(page.getByRole("button", { name: /check/i })).toBeEnabled();

    // Read current first item to determine order
    const firstItemText = await itemList
      .getByRole("listitem")
      .nth(0)
      .getByText(new RegExp(uniqueId))
      .innerText();

    // Ensure items are in wrong order (Second first, First second)
    if (firstItemText.startsWith("First")) {
      await page
        .getByRole("button", { name: new RegExp(`move First ${uniqueId} down`, "i") })
        .click();
    }

    await page.getByRole("button", { name: /check/i }).click();
    await expect(page.getByText(/not quite/i)).toBeVisible();
    await expect(page.getByText(new RegExp(`Try again ${uniqueId}`))).toBeVisible();

    // Inline corrections show "you had: #N" for misplaced items
    await expect(page.getByText(/you had: #2/i)).toBeVisible();
    await expect(page.getByText(/you had: #1/i)).toBeVisible();

    // Correct order summary line appears
    await expect(
      page.getByText(new RegExp(`Correct order: First ${uniqueId} → Second ${uniqueId}`)),
    ).toBeVisible();
  });

  test("continue button appears after checking", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createSortOrderActivity({
      steps: [
        {
          content: {
            feedback: `Nice ${uniqueId}`,
            items: [`A ${uniqueId}`, `B ${uniqueId}`],
            question: `Sort ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);

    await page.getByRole("button", { name: /check/i }).click();

    await expect(page.getByRole("button", { name: /continue/i })).toBeVisible();
  });

  test("full flow: check, feedback, continue, completion", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createSortOrderActivity({
      steps: [
        {
          content: {
            feedback: `Nice ${uniqueId}`,
            items: [`A ${uniqueId}`, `B ${uniqueId}`],
            question: `Sort ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);

    // Click Check with whatever order (correct or not, both produce feedback)
    await page.getByRole("button", { name: /check/i }).click();
    await expect(page.getByText(new RegExp(`Nice ${uniqueId}`))).toBeVisible();

    await page.getByRole("button", { name: /continue/i }).click();

    // Score depends on random shuffle — either 0/1 or 1/1
    await expect(page.getByText(/[01]\/1/)).toBeVisible();
    await expect(page.getByText(/correct/i)).toBeVisible();
  });

  test("arrow buttons hide at boundaries", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createSortOrderActivity({
      steps: [
        {
          content: {
            feedback: `Feedback ${uniqueId}`,
            items: [`Top ${uniqueId}`, `Middle ${uniqueId}`, `Bottom ${uniqueId}`],
            question: `Order ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);

    // Wait for hydration
    await expect(page.getByRole("button", { name: /check/i })).toBeEnabled();

    const itemList = page.getByRole("list", { name: /sort items/i });

    // Read the actual first and last item texts (shuffled)
    const firstItemText = await itemList
      .getByRole("listitem")
      .nth(0)
      .getByText(new RegExp(uniqueId))
      .innerText();
    const lastItemText = await itemList
      .getByRole("listitem")
      .nth(2)
      .getByText(new RegExp(uniqueId))
      .innerText();

    // First item should have no up button
    await expect(
      page.getByRole("button", { name: new RegExp(`move ${firstItemText} up`, "i") }),
    ).not.toBeVisible();
    // First item should have a down button
    await expect(
      page.getByRole("button", { name: new RegExp(`move ${firstItemText} down`, "i") }),
    ).toBeVisible();

    // Last item should have no down button
    await expect(
      page.getByRole("button", { name: new RegExp(`move ${lastItemText} down`, "i") }),
    ).not.toBeVisible();
    // Last item should have an up button
    await expect(
      page.getByRole("button", { name: new RegExp(`move ${lastItemText} up`, "i") }),
    ).toBeVisible();
  });

  test("keyboard ArrowDown on focused row moves item down", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createSortOrderActivity({
      steps: [
        {
          content: {
            feedback: `Feedback ${uniqueId}`,
            items: [`Alpha ${uniqueId}`, `Beta ${uniqueId}`, `Gamma ${uniqueId}`],
            question: `Order ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);

    const itemList = page.getByRole("list", { name: /sort items/i });

    // Wait for hydration
    await expect(page.getByRole("button", { name: /check/i })).toBeEnabled();

    // Read initial first item
    const initialFirstText = await itemList
      .getByRole("listitem")
      .nth(0)
      .getByText(new RegExp(uniqueId))
      .innerText();

    // Focus the down button of the first item and press ArrowDown on the row
    const firstRow = itemList.getByRole("listitem").nth(0);
    await firstRow
      .getByRole("button", { name: new RegExp(`move ${initialFirstText} down`, "i") })
      .focus();

    // Press ArrowDown on the row (event bubbles from the button)
    await page.keyboard.press("ArrowDown");

    // After move, the first position should have a different item
    const newFirstText = await itemList
      .getByRole("listitem")
      .nth(0)
      .getByText(new RegExp(uniqueId))
      .innerText();

    expect(newFirstText).not.toBe(initialFirstText);

    // Screen reader announcement should appear
    await expect(page.getByRole("status")).toHaveText(
      new RegExp(`${initialFirstText}.*position 2`, "i"),
    );
  });
});

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
  test("renders question, empty slots, and full-width item tiles", async ({ page }) => {
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

    const slotList = page.getByRole("list", { name: /answer slots/i });
    await expect(slotList).toBeVisible();

    const itemPool = page.getByRole("group", { name: /available items/i });
    await expect(itemPool.getByRole("button", { name: `First ${uniqueId}` })).toBeVisible();
    await expect(itemPool.getByRole("button", { name: `Second ${uniqueId}` })).toBeVisible();
    await expect(itemPool.getByRole("button", { name: `Third ${uniqueId}` })).toBeVisible();
  });

  test("tapping an item places it in the first empty slot", async ({ page }) => {
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

    const itemPool = page.getByRole("group", { name: /available items/i });
    await itemPool.getByRole("button", { name: `Alpha ${uniqueId}` }).click();

    await expect(
      page.getByRole("button", { name: new RegExp(`Slot 1.*Alpha ${uniqueId}`) }),
    ).toBeVisible();
  });

  test("tapping a filled slot returns item to pool", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createSortOrderActivity({
      steps: [
        {
          content: {
            feedback: `Feedback ${uniqueId}`,
            items: [`Uno ${uniqueId}`, `Dos ${uniqueId}`],
            question: `Order ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);

    const itemPool = page.getByRole("group", { name: /available items/i });
    await itemPool.getByRole("button", { name: `Uno ${uniqueId}` }).click();

    const filledSlot = page.getByRole("button", { name: new RegExp(`Slot 1.*Uno ${uniqueId}`) });
    await expect(filledSlot).toBeVisible();

    await filledSlot.click();

    await expect(
      page.getByRole("button", { name: new RegExp(`Slot 1.*Uno ${uniqueId}`) }),
    ).not.toBeVisible();

    await expect(itemPool.getByRole("button", { name: `Uno ${uniqueId}` })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  test("check button disabled until all slots filled", async ({ page }) => {
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
    await page.waitForLoadState("networkidle");

    const checkButton = page.getByRole("button", { name: /check/i });
    await expect(checkButton).toBeDisabled();

    const itemPool = page.getByRole("group", { name: /available items/i });
    await itemPool.getByRole("button", { name: `X ${uniqueId}` }).click();

    await expect(checkButton).toBeDisabled();

    await itemPool.getByRole("button", { name: `Y ${uniqueId}` }).click();

    await expect(checkButton).toBeEnabled();
  });

  test("correct answer shows inline feedback with green indicators", async ({ page }) => {
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
    await page.waitForLoadState("networkidle");

    const itemPool = page.getByRole("group", { name: /available items/i });

    await itemPool.getByRole("button", { name: `Step1 ${uniqueId}` }).click();
    await itemPool.getByRole("button", { name: `Step2 ${uniqueId}` }).click();

    await page.getByRole("button", { name: /check/i }).click();

    // Inline feedback shows Correct!
    await expect(page.getByText(/correct!/i)).toBeVisible();
    await expect(page.getByText(new RegExp(`Well done ${uniqueId}`))).toBeVisible();

    // Item pool should be hidden
    await expect(page.getByRole("group", { name: /available items/i })).not.toBeVisible();

    // Slots should show result state (Correct in aria-label)
    await expect(
      page.getByRole("button", { name: new RegExp(`Slot 1.*Step1 ${uniqueId}.*Correct`) }),
    ).toBeVisible();
  });

  test("incorrect answer shows inline feedback with correct order", async ({ page }) => {
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
    await page.waitForLoadState("networkidle");

    const itemPool = page.getByRole("group", { name: /available items/i });

    // Place in wrong order
    await itemPool.getByRole("button", { name: `Second ${uniqueId}` }).click();
    await itemPool.getByRole("button", { name: `First ${uniqueId}` }).click();

    await page.getByRole("button", { name: /check/i }).click();

    // Inline feedback shows Not quite
    await expect(page.getByText(/not quite/i)).toBeVisible();

    // Shows correct order
    await expect(page.getByText(/correct order/i)).toBeVisible();
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
    await page.waitForLoadState("networkidle");

    const itemPool = page.getByRole("group", { name: /available items/i });

    await itemPool.getByRole("button", { name: `A ${uniqueId}` }).click();
    await itemPool.getByRole("button", { name: `B ${uniqueId}` }).click();

    await page.getByRole("button", { name: /check/i }).click();

    await expect(page.getByRole("button", { name: /continue/i })).toBeVisible();
  });

  test("full flow: place all, check, inline feedback, continue, completion", async ({ page }) => {
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
    await page.waitForLoadState("networkidle");

    const itemPool = page.getByRole("group", { name: /available items/i });

    await itemPool.getByRole("button", { name: `A ${uniqueId}` }).click();
    await itemPool.getByRole("button", { name: `B ${uniqueId}` }).click();

    await page.getByRole("button", { name: /check/i }).click();
    await expect(page.getByText(/correct!/i)).toBeVisible();

    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByText("1/1")).toBeVisible();
    await expect(page.getByText(/correct/i)).toBeVisible();
  });
});

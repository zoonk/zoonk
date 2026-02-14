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
  test("renders question, instruction text, and shuffled item list", async ({ page }) => {
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
    await expect(page.getByText(/tap items in the correct order/i)).toBeVisible();

    const itemList = page.getByRole("list", { name: /sort items/i });
    await expect(itemList).toBeVisible();

    await expect(
      itemList.getByRole("button", { name: new RegExp(`First ${uniqueId}`) }),
    ).toBeVisible();
    await expect(
      itemList.getByRole("button", { name: new RegExp(`Second ${uniqueId}`) }),
    ).toBeVisible();
    await expect(
      itemList.getByRole("button", { name: new RegExp(`Third ${uniqueId}`) }),
    ).toBeVisible();
  });

  test("tapping an item assigns the next sequential number", async ({ page }) => {
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
    await itemList
      .getByRole("button", { name: new RegExp(`Alpha ${uniqueId}.*Tap to select`) })
      .click();

    await expect(
      itemList.getByRole("button", { name: new RegExp(`Position 1.*Alpha ${uniqueId}`) }),
    ).toBeVisible();
  });

  test("tapping a selected item removes its number and renumbers higher items", async ({
    page,
  }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createSortOrderActivity({
      steps: [
        {
          content: {
            feedback: `Feedback ${uniqueId}`,
            items: [`Uno ${uniqueId}`, `Dos ${uniqueId}`, `Tres ${uniqueId}`],
            question: `Order ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);

    const itemList = page.getByRole("list", { name: /sort items/i });

    // First click: resilient to hydration timing
    const unoSelected = itemList.getByRole("button", {
      name: new RegExp(`Position 1.*Uno ${uniqueId}`),
    });

    await expect(async () => {
      if (!(await unoSelected.isVisible())) {
        await itemList
          .getByRole("button", { name: new RegExp(`Uno ${uniqueId}.*Tap to select`) })
          .click();
      }
      await expect(unoSelected).toBeVisible({ timeout: 1000 });
    }).toPass();

    // Subsequent clicks: page is hydrated, add assertions for determinism
    await itemList
      .getByRole("button", { name: new RegExp(`Dos ${uniqueId}.*Tap to select`) })
      .click();
    await expect(
      itemList.getByRole("button", { name: new RegExp(`Position 2.*Dos ${uniqueId}`) }),
    ).toBeVisible();

    await itemList
      .getByRole("button", { name: new RegExp(`Tres ${uniqueId}.*Tap to select`) })
      .click();
    await expect(
      itemList.getByRole("button", { name: new RegExp(`Position 3.*Tres ${uniqueId}`) }),
    ).toBeVisible();

    // Remove #2 (Dos) — Tres should become #2
    await itemList.getByRole("button", { name: new RegExp(`Position 2.*Dos ${uniqueId}`) }).click();

    await expect(
      itemList.getByRole("button", { name: new RegExp(`Position 1.*Uno ${uniqueId}`) }),
    ).toBeVisible();
    await expect(
      itemList.getByRole("button", { name: new RegExp(`Dos ${uniqueId}.*Tap to select`) }),
    ).toBeVisible();
    await expect(
      itemList.getByRole("button", { name: new RegExp(`Position 2.*Tres ${uniqueId}`) }),
    ).toBeVisible();
  });

  test("check button disabled until all items selected", async ({ page }) => {
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

    const itemList = page.getByRole("list", { name: /sort items/i });
    await itemList
      .getByRole("button", { name: new RegExp(`X ${uniqueId}.*Tap to select`) })
      .click();

    await expect(checkButton).toBeDisabled();

    await itemList
      .getByRole("button", { name: new RegExp(`Y ${uniqueId}.*Tap to select`) })
      .click();

    await expect(checkButton).toBeEnabled();
  });

  test("correct answer shows custom feedback and green indicators", async ({ page }) => {
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

    const itemList = page.getByRole("list", { name: /sort items/i });

    await itemList
      .getByRole("button", { name: new RegExp(`Step1 ${uniqueId}.*Tap to select`) })
      .click();
    await itemList
      .getByRole("button", { name: new RegExp(`Step2 ${uniqueId}.*Tap to select`) })
      .click();

    await page.getByRole("button", { name: /check/i }).click();

    // Custom feedback is shown
    await expect(page.getByText(new RegExp(`Well done ${uniqueId}`))).toBeVisible();

    // Items show correct result state (list reorders to correct order)
    await expect(
      itemList.getByRole("button", { name: new RegExp(`Step1 ${uniqueId}.*Correct`) }),
    ).toBeVisible();
    await expect(
      itemList.getByRole("button", { name: new RegExp(`Step2 ${uniqueId}.*Correct`) }),
    ).toBeVisible();
  });

  test("incorrect answer reorders list to correct order with red indicators", async ({ page }) => {
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

    const itemList = page.getByRole("list", { name: /sort items/i });

    // Place in wrong order
    await itemList
      .getByRole("button", { name: new RegExp(`Second ${uniqueId}.*Tap to select`) })
      .click();
    await itemList
      .getByRole("button", { name: new RegExp(`First ${uniqueId}.*Tap to select`) })
      .click();

    await page.getByRole("button", { name: /check/i }).click();

    // List reorders to correct order with incorrect indicators
    await expect(
      itemList.getByRole("button", { name: new RegExp(`First ${uniqueId}.*Incorrect`) }),
    ).toBeVisible();
    await expect(
      itemList.getByRole("button", { name: new RegExp(`Second ${uniqueId}.*Incorrect`) }),
    ).toBeVisible();

    // Custom feedback shown
    await expect(page.getByText(new RegExp(`Try again ${uniqueId}`))).toBeVisible();
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

    const itemList = page.getByRole("list", { name: /sort items/i });

    await itemList
      .getByRole("button", { name: new RegExp(`A ${uniqueId}.*Tap to select`) })
      .click();
    await itemList
      .getByRole("button", { name: new RegExp(`B ${uniqueId}.*Tap to select`) })
      .click();

    await page.getByRole("button", { name: /check/i }).click();

    await expect(page.getByRole("button", { name: /continue/i })).toBeVisible();
  });

  test("full flow: select all, check, feedback, continue, completion", async ({ page }) => {
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

    const itemList = page.getByRole("list", { name: /sort items/i });

    await itemList
      .getByRole("button", { name: new RegExp(`A ${uniqueId}.*Tap to select`) })
      .click();
    await itemList
      .getByRole("button", { name: new RegExp(`B ${uniqueId}.*Tap to select`) })
      .click();

    await page.getByRole("button", { name: /check/i }).click();
    await expect(page.getByText(new RegExp(`Nice ${uniqueId}`))).toBeVisible();

    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByText("1/1")).toBeVisible();
    await expect(page.getByText(/correct/i)).toBeVisible();
  });
});

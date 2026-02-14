import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { expect, test } from "./fixtures";

async function createFillBlankActivity(options: {
  steps: { content: object; position: number }[];
}) {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: "ai" },
  });

  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-fb-course-${uniqueId}`,
    title: `E2E FB Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-fb-chapter-${uniqueId}`,
    title: `E2E FB Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    description: `E2E fb lesson ${uniqueId}`,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-fb-lesson-${uniqueId}`,
    title: `E2E FB Lesson ${uniqueId}`,
  });

  const activity = await activityFixture({
    generationStatus: "completed",
    isPublished: true,
    kind: "background",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 0,
    title: `E2E FB Activity ${uniqueId}`,
  });

  await Promise.all(
    options.steps.map((step) =>
      stepFixture({
        activityId: activity.id,
        content: step.content,
        isPublished: true,
        kind: "fillBlank",
        position: step.position,
      }),
    ),
  );

  const url = `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/0`;

  return { activity, chapter, course, lesson, uniqueId, url };
}

test.describe("Fill Blank Step", () => {
  test("renders template text and word bank tiles", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createFillBlankActivity({
      steps: [
        {
          content: {
            answers: ["cat", "mat"],
            distractors: ["dog"],
            feedback: `Good job ${uniqueId}`,
            question: `Fill the blanks ${uniqueId}`,
            template: `The ${uniqueId} [BLANK] sat on the [BLANK]`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);

    await expect(page.getByText(new RegExp(`Fill the blanks ${uniqueId}`))).toBeVisible();
    await expect(page.getByText(new RegExp(`The ${uniqueId}`))).toBeVisible();

    const wordBank = page.getByRole("group", { name: /word bank/i });
    await expect(wordBank).toBeVisible();

    await expect(wordBank.getByRole("button", { name: "cat" })).toBeVisible();
    await expect(wordBank.getByRole("button", { name: "mat" })).toBeVisible();
    await expect(wordBank.getByRole("button", { name: "dog" })).toBeVisible();
  });

  test("tapping a word places it in the first empty blank", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createFillBlankActivity({
      steps: [
        {
          content: {
            answers: ["sun"],
            distractors: ["moon"],
            feedback: `Feedback ${uniqueId}`,
            template: `The ${uniqueId} [BLANK] is bright`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);

    const wordBank = page.getByRole("group", { name: /word bank/i });
    await wordBank.getByRole("button", { name: "sun" }).click();

    await expect(page.getByRole("button", { name: /blank 1: sun/i })).toBeVisible();
  });

  test("tapping a placed word returns it to the bank", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createFillBlankActivity({
      steps: [
        {
          content: {
            answers: ["rain"],
            distractors: ["snow"],
            feedback: `Feedback ${uniqueId}`,
            template: `The ${uniqueId} [BLANK] falls`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);

    const wordBank = page.getByRole("group", { name: /word bank/i });
    await wordBank.getByRole("button", { name: "rain" }).click();

    const filledBlank = page.getByRole("button", { name: /blank 1: rain/i });
    await expect(filledBlank).toBeVisible();

    await filledBlank.click();

    await expect(page.getByRole("button", { name: /blank 1: rain/i })).not.toBeVisible();
    await expect(wordBank.getByRole("button", { name: "rain" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  test("correct answer shows Correct! feedback", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createFillBlankActivity({
      steps: [
        {
          content: {
            answers: ["blue"],
            distractors: ["red"],
            feedback: `Well done ${uniqueId}`,
            template: `The sky is [BLANK] ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    const wordBank = page.getByRole("group", { name: /word bank/i });
    await wordBank.getByRole("button", { name: "blue" }).click();

    await page.getByRole("button", { name: /check/i }).click();

    await expect(page.getByText(/correct!/i)).toBeVisible();
    await expect(page.getByText(new RegExp(`Well done ${uniqueId}`))).toBeVisible();
  });

  test("incorrect answer shows Not quite", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createFillBlankActivity({
      steps: [
        {
          content: {
            answers: ["blue"],
            distractors: ["red"],
            feedback: `Try again ${uniqueId}`,
            template: `The sky is [BLANK] ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    const wordBank = page.getByRole("group", { name: /word bank/i });
    await wordBank.getByRole("button", { name: "red" }).click();

    await page.getByRole("button", { name: /check/i }).click();

    await expect(page.getByText(/not quite/i)).toBeVisible();
  });

  test("check button disabled until all blanks filled", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createFillBlankActivity({
      steps: [
        {
          content: {
            answers: ["one", "two"],
            distractors: ["three"],
            feedback: `Feedback ${uniqueId}`,
            template: `Count ${uniqueId} [BLANK] and [BLANK]`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    const checkButton = page.getByRole("button", { name: /check/i });
    await expect(checkButton).toBeDisabled();

    const wordBank = page.getByRole("group", { name: /word bank/i });
    await wordBank.getByRole("button", { name: "one" }).click();

    await expect(checkButton).toBeDisabled();

    await wordBank.getByRole("button", { name: "two" }).click();

    await expect(checkButton).toBeEnabled();
  });

  test("clearing a blank disables Check button", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createFillBlankActivity({
      steps: [
        {
          content: {
            answers: ["fast"],
            distractors: ["slow"],
            feedback: `Feedback ${uniqueId}`,
            template: `The car is [BLANK] ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    const checkButton = page.getByRole("button", { name: /check/i });
    const wordBank = page.getByRole("group", { name: /word bank/i });

    await wordBank.getByRole("button", { name: "fast" }).click();
    await expect(checkButton).toBeEnabled();

    await page.getByRole("button", { name: /blank 1: fast/i }).click();
    await expect(checkButton).toBeDisabled();
  });

  test("full flow: fill, check, continue, completion", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createFillBlankActivity({
      steps: [
        {
          content: {
            answers: ["world"],
            distractors: ["earth"],
            feedback: `Nice ${uniqueId}`,
            template: `Hello [BLANK] ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    const wordBank = page.getByRole("group", { name: /word bank/i });
    await wordBank.getByRole("button", { name: "world" }).click();

    await page.getByRole("button", { name: /check/i }).click();
    await expect(page.getByText(/correct!/i)).toBeVisible();

    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByText("1/1")).toBeVisible();
    await expect(page.getByText(/correct/i)).toBeVisible();
  });
});

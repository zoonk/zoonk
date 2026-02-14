import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { expect, test } from "./fixtures";

async function createSelectImageActivity(options: {
  steps: { content: object; position: number }[];
}) {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: "ai" },
  });

  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-si-course-${uniqueId}`,
    title: `E2E SI Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-si-chapter-${uniqueId}`,
    title: `E2E SI Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    description: `E2E si lesson ${uniqueId}`,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-si-lesson-${uniqueId}`,
    title: `E2E SI Lesson ${uniqueId}`,
  });

  const activity = await activityFixture({
    generationStatus: "completed",
    isPublished: true,
    kind: "background",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 0,
    title: `E2E SI Activity ${uniqueId}`,
  });

  await Promise.all(
    options.steps.map((step) =>
      stepFixture({
        activityId: activity.id,
        content: step.content,
        isPublished: true,
        kind: "selectImage",
        position: step.position,
      }),
    ),
  );

  const url = `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/0`;

  return { activity, chapter, course, lesson, uniqueId, url };
}

test.describe("Select Image Step", () => {
  test("renders question and image options as radio buttons", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createSelectImageActivity({
      steps: [
        {
          content: {
            options: [
              {
                feedback: "Correct!",
                isCorrect: true,
                prompt: `Cat ${uniqueId}`,
                url: "https://to3kaoi21m60hzgu.public.blob.vercel-storage.com/test-cat.jpg",
              },
              {
                feedback: "Not quite",
                isCorrect: false,
                prompt: `Dog ${uniqueId}`,
                url: "https://to3kaoi21m60hzgu.public.blob.vercel-storage.com/test-dog.jpg",
              },
            ],
            question: `Which is a cat ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);

    await expect(page.getByText(new RegExp(`Which is a cat ${uniqueId}`))).toBeVisible();

    const radiogroup = page.getByRole("radiogroup", { name: /image options/i });
    await expect(radiogroup).toBeVisible();

    await expect(
      radiogroup.getByRole("radio", { name: new RegExp(`Cat ${uniqueId}`) }),
    ).toBeVisible();
    await expect(
      radiogroup.getByRole("radio", { name: new RegExp(`Dog ${uniqueId}`) }),
    ).toBeVisible();
  });

  test("selecting an image marks it as checked", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createSelectImageActivity({
      steps: [
        {
          content: {
            options: [
              { feedback: "Yes", isCorrect: true, prompt: `Alpha ${uniqueId}` },
              { feedback: "No", isCorrect: false, prompt: `Beta ${uniqueId}` },
            ],
            question: `Pick one ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    const alpha = page.getByRole("radio", { name: new RegExp(`Alpha ${uniqueId}`) });
    const beta = page.getByRole("radio", { name: new RegExp(`Beta ${uniqueId}`) });

    await alpha.click();

    await expect(alpha).toHaveAttribute("aria-checked", "true");
    await expect(beta).toHaveAttribute("aria-checked", "false");
  });

  test("check button disabled until selection", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createSelectImageActivity({
      steps: [
        {
          content: {
            options: [
              { feedback: "Yes", isCorrect: true, prompt: `Opt1 ${uniqueId}` },
              { feedback: "No", isCorrect: false, prompt: `Opt2 ${uniqueId}` },
            ],
            question: `Select ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("button", { name: /check/i })).toBeDisabled();

    await page.getByRole("radio", { name: new RegExp(`Opt1 ${uniqueId}`) }).click();

    await expect(page.getByRole("button", { name: /check/i })).toBeEnabled();
  });

  test("correct answer shows feedback", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createSelectImageActivity({
      steps: [
        {
          content: {
            options: [
              { feedback: `Well done ${uniqueId}`, isCorrect: true, prompt: `Right ${uniqueId}` },
              { feedback: "Nope", isCorrect: false, prompt: `Wrong ${uniqueId}` },
            ],
            question: `Pick correct ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.getByRole("radio", { name: new RegExp(`Right ${uniqueId}`) }).click();
    await page.getByRole("button", { name: /check/i }).click();

    await expect(page.getByText(/correct!/i)).toBeVisible();
    await expect(page.getByText(new RegExp(`Well done ${uniqueId}`))).toBeVisible();
  });

  test("incorrect answer shows feedback", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createSelectImageActivity({
      steps: [
        {
          content: {
            options: [
              { feedback: "Good job", isCorrect: true, prompt: `Correct ${uniqueId}` },
              {
                feedback: `Try again ${uniqueId}`,
                isCorrect: false,
                prompt: `Incorrect ${uniqueId}`,
              },
            ],
            question: `Pick one ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.getByRole("radio", { name: new RegExp(`Incorrect ${uniqueId}`) }).click();
    await page.getByRole("button", { name: /check/i }).click();

    await expect(page.getByText(/not quite/i)).toBeVisible();
    await expect(page.getByText(new RegExp(`Try again ${uniqueId}`))).toBeVisible();
  });

  test("changing selection before checking", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createSelectImageActivity({
      steps: [
        {
          content: {
            options: [
              { feedback: "Yes", isCorrect: true, prompt: `First ${uniqueId}` },
              { feedback: "No", isCorrect: false, prompt: `Second ${uniqueId}` },
            ],
            question: `Change test ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    const first = page.getByRole("radio", { name: new RegExp(`First ${uniqueId}`) });
    const second = page.getByRole("radio", { name: new RegExp(`Second ${uniqueId}`) });

    await first.click();
    await expect(first).toHaveAttribute("aria-checked", "true");
    await expect(second).toHaveAttribute("aria-checked", "false");

    await second.click();
    await expect(second).toHaveAttribute("aria-checked", "true");
    await expect(first).toHaveAttribute("aria-checked", "false");
  });

  test("full flow: select, check, feedback, continue, completion", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createSelectImageActivity({
      steps: [
        {
          content: {
            options: [
              { feedback: `Nice ${uniqueId}`, isCorrect: true, prompt: `Winner ${uniqueId}` },
              { feedback: "Nope", isCorrect: false, prompt: `Loser ${uniqueId}` },
            ],
            question: `Full flow ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.getByRole("radio", { name: new RegExp(`Winner ${uniqueId}`) }).click();
    await page.getByRole("button", { name: /check/i }).click();

    await expect(page.getByText(/correct!/i)).toBeVisible();
    await expect(page.getByText(new RegExp(`Nice ${uniqueId}`))).toBeVisible();

    await page.getByRole("button", { name: /continue/i }).click();

    await expect(page.getByText("1/1")).toBeVisible();
    await expect(page.getByText(/correct/i)).toBeVisible();
  });

  test("missing URL shows prompt text as fallback", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createSelectImageActivity({
      steps: [
        {
          content: {
            options: [
              { feedback: "Yes", isCorrect: true, prompt: `NoImage ${uniqueId}` },
              { feedback: "No", isCorrect: false, prompt: `HasImage ${uniqueId}` },
            ],
            question: `Fallback test ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);

    // The option without URL should be rendered and selectable
    const noImageOption = page.getByRole("radio", { name: new RegExp(`NoImage ${uniqueId}`) });
    await expect(noImageOption).toBeVisible();

    await noImageOption.click();
    await expect(noImageOption).toHaveAttribute("aria-checked", "true");
  });

  test("keyboard shortcut selects option", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createSelectImageActivity({
      steps: [
        {
          content: {
            options: [
              { feedback: `Fb1 ${uniqueId}`, isCorrect: true, prompt: `Img1 ${uniqueId}` },
              { feedback: `Fb2 ${uniqueId}`, isCorrect: false, prompt: `Img2 ${uniqueId}` },
            ],
            question: `Keyboard test ${uniqueId}`,
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.keyboard.press("1");

    await expect(page.getByRole("button", { name: /check/i })).toBeEnabled();

    await page.keyboard.press("Enter");
    await expect(page.getByText(new RegExp(`Fb[12] ${uniqueId}`))).toBeVisible();
  });
});

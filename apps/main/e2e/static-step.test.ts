import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { expect, test } from "./fixtures";

async function createStaticActivity(options: { steps: { content: object; position: number }[] }) {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: "ai" },
  });

  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-static-course-${uniqueId}`,
    title: `E2E Static Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-static-chapter-${uniqueId}`,
    title: `E2E Static Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    description: `E2E static lesson ${uniqueId}`,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-static-lesson-${uniqueId}`,
    title: `E2E Static Lesson ${uniqueId}`,
  });

  const activity = await activityFixture({
    generationStatus: "completed",
    isPublished: true,
    kind: "background",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 0,
    title: `E2E Static Activity ${uniqueId}`,
  });

  await Promise.all(
    options.steps.map((step) =>
      stepFixture({
        activityId: activity.id,
        content: step.content,
        position: step.position,
      }),
    ),
  );

  const url = `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/0`;

  return { activity, chapter, course, lesson, uniqueId, url };
}

test.describe("Static Step Rendering", () => {
  test("text variant renders title and body", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createStaticActivity({
      steps: [
        {
          content: {
            text: `Welcome body text ${uniqueId}`,
            title: `Welcome Title ${uniqueId}`,
            variant: "text",
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await expect(
      page.getByRole("heading", { name: new RegExp(`Welcome Title ${uniqueId}`) }),
    ).toBeVisible();
    await expect(page.getByText(new RegExp(`Welcome body text ${uniqueId}`))).toBeVisible();
  });

  test("grammar example renders sentence with highlight, romanization, and translation", async ({
    page,
  }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createStaticActivity({
      steps: [
        {
          content: {
            highlight: "corre",
            romanization: "ko-rre",
            sentence: `Ella corre rapido ${uniqueId}`,
            translation: `She runs fast ${uniqueId}`,
            variant: "grammarExample",
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await expect(page.getByText(new RegExp(`Ella.*corre.*rapido ${uniqueId}`))).toBeVisible();
    await expect(page.getByText("corre")).toBeVisible();
    await expect(page.getByText("ko-rre")).toBeVisible();
    await expect(page.getByText(new RegExp(`She runs fast ${uniqueId}`))).toBeVisible();
  });

  test("grammar example without romanization does not render romanization", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createStaticActivity({
      steps: [
        {
          content: {
            highlight: "runs",
            romanization: null,
            sentence: `She runs fast ${uniqueId}`,
            translation: `Ella corre rapido ${uniqueId}`,
            variant: "grammarExample",
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await expect(page.getByText(new RegExp(`She.*runs.*fast ${uniqueId}`))).toBeVisible();
    await expect(page.getByText(new RegExp(`Ella corre rapido ${uniqueId}`))).toBeVisible();

    // Verify no italic romanization element is present
    const italicElements = page.locator("p.italic");
    await expect(italicElements).toHaveCount(0);
  });

  test("grammar rule renders rule name and summary", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createStaticActivity({
      steps: [
        {
          content: {
            ruleName: `Past Tense ${uniqueId}`,
            ruleSummary: `Add -ed to the verb ${uniqueId}`,
            variant: "grammarRule",
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await expect(
      page.getByRole("heading", { name: new RegExp(`Past Tense ${uniqueId}`) }),
    ).toBeVisible();
    await expect(page.getByText(new RegExp(`Add -ed to the verb ${uniqueId}`))).toBeVisible();
  });
});

test.describe("Static Step Navigation", () => {
  test("ArrowRight advances to next step", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createStaticActivity({
      steps: [
        {
          content: {
            text: `Step 1 body ${uniqueId}`,
            title: `Step 1 ${uniqueId}`,
            variant: "text",
          },
          position: 0,
        },
        {
          content: {
            text: `Step 2 body ${uniqueId}`,
            title: `Step 2 ${uniqueId}`,
            variant: "text",
          },
          position: 1,
        },
      ],
    });

    await page.goto(url);
    await expect(
      page.getByRole("heading", { name: new RegExp(`Step 1 ${uniqueId}`) }),
    ).toBeVisible();
    await expect(page.getByText(/1 \/ 2/)).toBeVisible();

    await page.waitForLoadState("networkidle");
    await page.keyboard.press("ArrowRight");

    await expect(
      page.getByRole("heading", { name: new RegExp(`Step 2 ${uniqueId}`) }),
    ).toBeVisible();
    await expect(page.getByText(/2 \/ 2/)).toBeVisible();
  });

  test("ArrowLeft goes to previous step", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createStaticActivity({
      steps: [
        {
          content: {
            text: `Step A body ${uniqueId}`,
            title: `Step A ${uniqueId}`,
            variant: "text",
          },
          position: 0,
        },
        {
          content: {
            text: `Step B body ${uniqueId}`,
            title: `Step B ${uniqueId}`,
            variant: "text",
          },
          position: 1,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("ArrowRight");

    await expect(
      page.getByRole("heading", { name: new RegExp(`Step B ${uniqueId}`) }),
    ).toBeVisible();

    await page.keyboard.press("ArrowLeft");
    await expect(
      page.getByRole("heading", { name: new RegExp(`Step A ${uniqueId}`) }),
    ).toBeVisible();
    await expect(page.getByText(/1 \/ 2/)).toBeVisible();
  });

  test("ArrowLeft on first step is a no-op", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createStaticActivity({
      steps: [
        {
          content: {
            text: `Only step body ${uniqueId}`,
            title: `Only Step ${uniqueId}`,
            variant: "text",
          },
          position: 0,
        },
        {
          content: {
            text: `Second body ${uniqueId}`,
            title: `Second ${uniqueId}`,
            variant: "text",
          },
          position: 1,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.keyboard.press("ArrowLeft");
    await expect(
      page.getByRole("heading", { name: new RegExp(`Only Step ${uniqueId}`) }),
    ).toBeVisible();
    await expect(page.getByText(/1 \/ 2/)).toBeVisible();
  });

  test("ArrowRight on last static step transitions to completed without score", async ({
    page,
  }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createStaticActivity({
      steps: [
        {
          content: {
            text: `Final body ${uniqueId}`,
            title: `Final Step ${uniqueId}`,
            variant: "text",
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.keyboard.press("ArrowRight");

    // Should show completion screen without a score for static-only activities
    const completionStatus = page.getByRole("status");
    await expect(completionStatus).toBeVisible();
    await expect(page.getByText(/correct/i)).not.toBeVisible();
    await expect(page.getByText(/0\/0/)).not.toBeVisible();
  });

  test("navigates forward and backward through multiple static steps", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createStaticActivity({
      steps: [
        {
          content: { text: `Body 1 ${uniqueId}`, title: `Step 1 ${uniqueId}`, variant: "text" },
          position: 0,
        },
        {
          content: { text: `Body 2 ${uniqueId}`, title: `Step 2 ${uniqueId}`, variant: "text" },
          position: 1,
        },
        {
          content: { text: `Body 3 ${uniqueId}`, title: `Step 3 ${uniqueId}`, variant: "text" },
          position: 2,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    // Forward through all steps
    await expect(
      page.getByRole("heading", { name: new RegExp(`Step 1 ${uniqueId}`) }),
    ).toBeVisible();

    await page.keyboard.press("ArrowRight");
    await expect(
      page.getByRole("heading", { name: new RegExp(`Step 2 ${uniqueId}`) }),
    ).toBeVisible();

    await page.keyboard.press("ArrowRight");
    await expect(
      page.getByRole("heading", { name: new RegExp(`Step 3 ${uniqueId}`) }),
    ).toBeVisible();

    // Back to step 2
    await page.keyboard.press("ArrowLeft");
    await expect(
      page.getByRole("heading", { name: new RegExp(`Step 2 ${uniqueId}`) }),
    ).toBeVisible();

    // Back to step 1
    await page.keyboard.press("ArrowLeft");
    await expect(
      page.getByRole("heading", { name: new RegExp(`Step 1 ${uniqueId}`) }),
    ).toBeVisible();
  });

  test("single static step — ArrowRight completes activity without score", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createStaticActivity({
      steps: [
        {
          content: {
            text: `Solo body ${uniqueId}`,
            title: `Solo Step ${uniqueId}`,
            variant: "text",
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await page.keyboard.press("ArrowRight");

    const completionStatus = page.getByRole("status");
    await expect(completionStatus).toBeVisible();
    await expect(page.getByText(/correct/i)).not.toBeVisible();
    await expect(page.getByText(/0\/0/)).not.toBeVisible();
  });

  test("click navigation — right area advances, left area goes back", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createStaticActivity({
      steps: [
        {
          content: {
            text: `Click 1 body ${uniqueId}`,
            title: `Click 1 ${uniqueId}`,
            variant: "text",
          },
          position: 0,
        },
        {
          content: {
            text: `Click 2 body ${uniqueId}`,
            title: `Click 2 ${uniqueId}`,
            variant: "text",
          },
          position: 1,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    // Click on the "Next step" button (right 2/3 area)
    await page.getByRole("button", { name: /next step/i }).click();
    await expect(
      page.getByRole("heading", { name: new RegExp(`Click 2 ${uniqueId}`) }),
    ).toBeVisible();

    // Click on the "Previous step" button (left 1/3 area)
    await page.getByRole("button", { name: /previous step/i }).click();
    await expect(
      page.getByRole("heading", { name: new RegExp(`Click 1 ${uniqueId}`) }),
    ).toBeVisible();
  });
});

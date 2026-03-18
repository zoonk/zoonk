import { randomUUID } from "node:crypto";
import { type Locator } from "@playwright/test";
import { getAiOrganization } from "@zoonk/e2e/helpers";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { expect, test } from "./fixtures";

async function swipeHorizontally(
  locator: Locator,
  options: { endX: number; startX: number; y: number },
) {
  await locator.evaluate((element, gesture) => {
    const startTouch = { clientX: gesture.startX, clientY: gesture.y };
    const endTouch = { clientX: gesture.endX, clientY: gesture.y };

    const touchStart = new Event("touchstart", { bubbles: true, cancelable: true });
    Object.defineProperty(touchStart, "touches", { value: [startTouch] });
    Object.defineProperty(touchStart, "targetTouches", { value: [startTouch] });
    Object.defineProperty(touchStart, "changedTouches", { value: [startTouch] });

    element.dispatchEvent(touchStart);

    const touchEnd = new Event("touchend", { bubbles: true, cancelable: true });
    Object.defineProperty(touchEnd, "touches", { value: [] });
    Object.defineProperty(touchEnd, "targetTouches", { value: [] });
    Object.defineProperty(touchEnd, "changedTouches", { value: [endTouch] });

    element.dispatchEvent(touchEnd);
  }, options);
}

async function createStaticActivity(options: {
  activityKind?: "challenge" | "explanation";
  steps: {
    content: object;
    kind?: "multipleChoice" | "static" | "visual";
    position: number;
  }[];
}) {
  const org = await getAiOrganization();

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
    kind: options.activityKind ?? "explanation",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 0,
    title: `E2E Static Activity ${uniqueId}`,
  });

  // Create a second activity so the tested one is not the last in the lesson.
  // This ensures tests see mid-lesson completion behavior (not lesson-complete).
  const [, nextActivity] = await Promise.all([
    ...options.steps.map((step) =>
      stepFixture({
        activityId: activity.id,
        content: step.content,
        isPublished: true,
        kind: step.kind ?? "static",
        position: step.position,
      }),
    ),
    activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "explanation",
      lessonId: lesson.id,
      organizationId: org.id,
      position: 1,
    }),
  ]);

  const url = `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/0`;

  return { activity, chapter, course, lesson, nextActivity, uniqueId, url };
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

  test("ArrowRight on last static step transitions to completed with Completed text", async ({
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

    // Should show completion screen with "Completed" text for static-only activities
    const completionStatus = page.getByRole("status");
    await expect(completionStatus).toBeVisible();
    await expect(page.getByText(/completed/i)).toBeVisible();
    await expect(page.getByText(/correct/i)).not.toBeVisible();
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

  test("single static step — ArrowRight completes activity with Completed text", async ({
    page,
  }) => {
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
    await expect(page.getByText(/completed/i)).toBeVisible();
    await expect(page.getByText(/correct/i)).not.toBeVisible();
  });

  test("completion screen shows Send feedback button", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createStaticActivity({
      steps: [
        {
          content: {
            text: `Feedback body ${uniqueId}`,
            title: `Feedback Step ${uniqueId}`,
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
    await expect(page.getByRole("button", { name: /send feedback/i })).toBeVisible();
  });

  test("bottom nav buttons navigate between steps", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createStaticActivity({
      steps: [
        {
          content: {
            text: `Nav 1 body ${uniqueId}`,
            title: `Nav 1 ${uniqueId}`,
            variant: "text",
          },
          position: 0,
        },
        {
          content: {
            text: `Nav 2 body ${uniqueId}`,
            title: `Nav 2 ${uniqueId}`,
            variant: "text",
          },
          position: 1,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: new RegExp(`Nav 1 ${uniqueId}`) }),
    ).toBeVisible();

    const nav = page.getByRole("navigation", { name: /step navigation/i });

    await nav.getByRole("button", { name: /next step/i }).click();
    await expect(
      page.getByRole("heading", { name: new RegExp(`Nav 2 ${uniqueId}`) }),
    ).toBeVisible();

    await nav.getByRole("button", { name: /previous step/i }).click();
    await expect(
      page.getByRole("heading", { name: new RegExp(`Nav 1 ${uniqueId}`) }),
    ).toBeVisible();
  });

  test("swiping on body text navigates between steps", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createStaticActivity({
      steps: [
        {
          content: {
            text: `Swipe 1 body ${uniqueId}`,
            title: `Swipe 1 ${uniqueId}`,
            variant: "text",
          },
          position: 0,
        },
        {
          content: {
            text: `Swipe 2 body ${uniqueId}`,
            title: `Swipe 2 ${uniqueId}`,
            variant: "text",
          },
          position: 1,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: new RegExp(`Swipe 1 ${uniqueId}`) }),
    ).toBeVisible();

    await swipeHorizontally(page.getByText(new RegExp(`Swipe 1 body ${uniqueId}`)), {
      endX: 20,
      startX: 140,
      y: 20,
    });

    await expect(
      page.getByRole("heading", { name: new RegExp(`Swipe 2 ${uniqueId}`) }),
    ).toBeVisible();

    await swipeHorizontally(page.getByText(new RegExp(`Swipe 2 body ${uniqueId}`)), {
      endX: 140,
      startX: 20,
      y: 20,
    });

    await expect(
      page.getByRole("heading", { name: new RegExp(`Swipe 1 ${uniqueId}`) }),
    ).toBeVisible();
  });

  test("prev button is disabled on first step", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createStaticActivity({
      steps: [
        {
          content: {
            text: `First body ${uniqueId}`,
            title: `First ${uniqueId}`,
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

    const nav = page.getByRole("navigation", { name: /step navigation/i });
    await expect(nav.getByRole("button", { name: /previous step/i })).toBeDisabled();
    await expect(nav.getByRole("button", { name: /next step/i })).toBeEnabled();
  });

  test("prev button stays disabled when the previous step is interactive", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createStaticActivity({
      activityKind: "challenge",
      steps: [
        {
          content: {
            context: `Challenge context ${uniqueId}`,
            kind: "challenge",
            options: [
              {
                consequence: `Safe outcome ${uniqueId}`,
                effects: [{ dimension: `Courage ${uniqueId}`, impact: "positive" }],
                text: `Safe choice ${uniqueId}`,
              },
              {
                consequence: `Risky outcome ${uniqueId}`,
                effects: [{ dimension: `Courage ${uniqueId}`, impact: "negative" }],
                text: `Risky choice ${uniqueId}`,
              },
            ],
            question: `Challenge question ${uniqueId}`,
          },
          kind: "multipleChoice",
          position: 0,
        },
        {
          content: {
            text: `Static body ${uniqueId}`,
            title: `Static recap ${uniqueId}`,
            variant: "text",
          },
          kind: "static",
          position: 1,
        },
      ],
    });

    await page.goto(url);
    await page.getByRole("button", { name: /begin/i }).click();
    await page.getByRole("radio", { name: new RegExp(`Safe choice ${uniqueId}`) }).click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    await expect(
      page.getByRole("heading", { name: new RegExp(`Static recap ${uniqueId}`) }),
    ).toBeVisible();

    const nav = page.getByRole("navigation", { name: /step navigation/i });
    await expect(nav.getByRole("button", { name: /previous step/i })).toBeDisabled();

    await page.keyboard.press("ArrowLeft");

    await expect(
      page.getByRole("heading", { name: new RegExp(`Static recap ${uniqueId}`) }),
    ).toBeVisible();
    await expect(page.getByText(new RegExp(`Challenge question ${uniqueId}`))).not.toBeVisible();
  });

  test("next button navigates to completion on last step", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createStaticActivity({
      steps: [
        {
          content: {
            text: `Last 1 body ${uniqueId}`,
            title: `Last 1 ${uniqueId}`,
            variant: "text",
          },
          position: 0,
        },
        {
          content: {
            text: `Last 2 body ${uniqueId}`,
            title: `Last 2 ${uniqueId}`,
            variant: "text",
          },
          position: 1,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    const nav = page.getByRole("navigation", { name: /step navigation/i });

    // Navigate to last step
    await nav.getByRole("button", { name: /next step/i }).click();
    await expect(
      page.getByRole("heading", { name: new RegExp(`Last 2 ${uniqueId}`) }),
    ).toBeVisible();

    // Next button should be enabled on last step
    await expect(nav.getByRole("button", { name: /next step/i })).toBeEnabled();

    // Clicking it should show completion screen
    await nav.getByRole("button", { name: /next step/i }).click();
    await expect(page.getByRole("status")).toBeVisible();
    await expect(page.getByText(/completed/i)).toBeVisible();
  });
});

test.describe("Completion Screen", () => {
  test("header and progress bar are hidden on completion screen", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createStaticActivity({
      steps: [
        {
          content: {
            text: `Header test body ${uniqueId}`,
            title: `Header Test ${uniqueId}`,
            variant: "text",
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    // Header, progress bar, and bottom nav visible before completion
    await expect(page.getByRole("link", { name: /close/i })).toBeVisible();
    await expect(page.getByText(/1 \/ 1/)).toBeVisible();
    await expect(page.getByRole("progressbar", { name: /activity progress/i })).toBeVisible();
    await expect(page.getByRole("navigation", { name: /step navigation/i })).toBeVisible();

    await page.keyboard.press("ArrowRight");

    // All chrome hidden on completion
    await expect(page.getByRole("status")).toBeVisible();
    await expect(page.getByRole("link", { name: /close/i })).not.toBeVisible();
    await expect(page.getByText(/1 \/ 1/)).not.toBeVisible();
    await expect(page.getByRole("progressbar", { name: /activity progress/i })).not.toBeVisible();
    await expect(page.getByRole("navigation", { name: /step navigation/i })).not.toBeVisible();
  });

  test("shows All Activities link and Try Again button", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createStaticActivity({
      steps: [
        {
          content: {
            text: `Actions test body ${uniqueId}`,
            title: `Actions Test ${uniqueId}`,
            variant: "text",
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("ArrowRight");

    await expect(page.getByRole("status")).toBeVisible();
    await expect(page.getByRole("link", { name: /all activities/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /try again/i })).toBeVisible();
  });

  test("pressing R on completion screen restarts activity", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createStaticActivity({
      steps: [
        {
          content: {
            text: `R key 1 body ${uniqueId}`,
            title: `R Key Step 1 ${uniqueId}`,
            variant: "text",
          },
          position: 0,
        },
        {
          content: {
            text: `R key 2 body ${uniqueId}`,
            title: `R Key Step 2 ${uniqueId}`,
            variant: "text",
          },
          position: 1,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    // Navigate to completion
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("status")).toBeVisible();

    // Press R to restart
    await page.keyboard.press("r");

    // Should be back at step 1
    await expect(
      page.getByRole("heading", { name: new RegExp(`R Key Step 1 ${uniqueId}`) }),
    ).toBeVisible();
    await expect(page.getByText(/1 \/ 2/)).toBeVisible();
  });

  test("pressing Enter on completion screen navigates back to lesson when no next activity", async ({
    page,
  }) => {
    const { lesson, url } = await createStaticActivity({
      steps: [
        {
          content: {
            text: "Enter key body",
            title: "Enter Key Step",
            variant: "text",
          },
          position: 0,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    // Navigate to completion
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("status")).toBeVisible();

    // Press Enter — no next activity, so should go back to lesson
    await page.keyboard.press("Enter");

    await page.waitForURL(new RegExp(lesson.slug));
  });

  test("clicking Try Again resets to first step", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createStaticActivity({
      steps: [
        {
          content: {
            text: `Restart 1 body ${uniqueId}`,
            title: `Restart Step 1 ${uniqueId}`,
            variant: "text",
          },
          position: 0,
        },
        {
          content: {
            text: `Restart 2 body ${uniqueId}`,
            title: `Restart Step 2 ${uniqueId}`,
            variant: "text",
          },
          position: 1,
        },
      ],
    });

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    // Navigate to completion
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("status")).toBeVisible();

    // Click Try Again
    await page.getByRole("button", { name: /try again/i }).click();

    // Should be back at step 1
    await expect(
      page.getByRole("heading", { name: new RegExp(`Restart Step 1 ${uniqueId}`) }),
    ).toBeVisible();
    await expect(page.getByText(/1 \/ 2/)).toBeVisible();

    // Header should be visible again
    await expect(page.getByRole("link", { name: /close/i })).toBeVisible();
  });
});

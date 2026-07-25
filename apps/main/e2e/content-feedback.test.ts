import { randomUUID } from "node:crypto";
import { type Page } from "@playwright/test";
import { openDialog } from "@zoonk/e2e/fixtures/dialog";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { type E2EUser, createE2EUser } from "@zoonk/e2e/fixtures/users";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { mockFeedbackSubmission } from "./feedback";
import { test as baseTest, expect } from "./fixtures";

/**
 * Completing the feedback lesson mutates learner progress, so every test owns
 * its user instead of changing the worker-scoped user used by read-only tests.
 */
const test = baseTest.extend<{ feedbackPage: Page; feedbackUser: E2EUser }>({
  feedbackPage: async ({ browser, feedbackUser }, use) => {
    const context = await browser.newContext({ storageState: feedbackUser.storageState });
    const page = await context.newPage();

    try {
      await use(page);
    } finally {
      await context.close();
    }
  },

  feedbackUser: async ({ baseURL }, use) => {
    const user = await createE2EUser(baseURL!, { orgRole: "member", withProgress: true });
    await use(user);
  },
});

/**
 * Creates a one-step quiz because content feedback now appears on the lesson
 * completion surface instead of the removed course-suggestion picker.
 */
async function createFeedbackLessonScenario() {
  const org = await getAiOrganization();
  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-feedback-course-${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-feedback-chapter-${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    isPublished: true,
    kind: "quiz",
    organizationId: org.id,
    position: 0,
    slug: `e2e-feedback-lesson-${uniqueId}`,
  });

  await lessonFixture({
    chapterId: chapter.id,
    isPublished: true,
    organizationId: org.id,
    position: 1,
    slug: `e2e-feedback-next-lesson-${uniqueId}`,
  });

  await stepFixture({
    content: {
      options: [
        { feedback: "Correct!", id: "right", isCorrect: true, text: `Right ${uniqueId}` },
        { feedback: "Wrong", id: "wrong", isCorrect: false, text: `Wrong ${uniqueId}` },
      ],
      question: `Question ${uniqueId}`,
    },
    isPublished: true,
    kind: "multipleChoice",
    lessonId: lesson.id,
  });

  return {
    correctAnswer: `Right ${uniqueId}`,
    lessonUrl: `/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`,
  };
}

/**
 * Opens a unique lesson, completes it, and waits for the content feedback
 * controls to render on the completion screen.
 */
async function openCompletedLessonFeedback(page: Page) {
  const scenario = await createFeedbackLessonScenario();

  await page.goto(scenario.lessonUrl);
  await page.getByRole("radio", { name: scenario.correctAnswer }).click();
  await page.getByRole("button", { name: /check/iu }).click();
  await page.getByRole("button", { name: /continue/iu }).click();

  const feedbackButton = page.getByRole("button", { name: /send feedback/iu });

  await expect(async () => {
    if (!(await feedbackButton.isVisible())) {
      const continueButton = page.getByRole("button", { name: /continue/iu });
      await expect(continueButton).toBeVisible({ timeout: 1000 });
      await continueButton.click();
    }

    await expect(feedbackButton).toBeVisible({ timeout: 1000 });
  }).toPass();
}

/**
 * Targets the named feedback dialog so an active toast with the same dialog
 * role cannot make the hydration-safe dialog helper skip the trigger click.
 */
async function openFeedbackDialog(page: Page) {
  const feedbackButton = page.getByRole("button", { name: /send feedback/iu });
  const dialog = page.getByRole("dialog", { name: /^feedback$/iu });

  await openDialog(feedbackButton, dialog);

  return dialog;
}

test.describe("Content Feedback", () => {
  test.beforeEach(async ({ feedbackPage }) => {
    await openCompletedLessonFeedback(feedbackPage);
  });

  test("clicking feedback button marks it as pressed", async ({ feedbackPage }) => {
    const thumbsUp = feedbackPage.getByRole("button", { name: /i liked it/iu });
    const thumbsDown = feedbackPage.getByRole("button", { name: /i didn't like it/iu });

    await expect(thumbsUp).toHaveAttribute("aria-pressed", "false");
    await expect(thumbsDown).toHaveAttribute("aria-pressed", "false");

    await thumbsUp.click();
    await expect(thumbsUp).toHaveAttribute("aria-pressed", "true");
    await expect(thumbsDown).toHaveAttribute("aria-pressed", "false");

    await thumbsDown.click();
    await expect(thumbsDown).toHaveAttribute("aria-pressed", "true");
    await expect(thumbsUp).toHaveAttribute("aria-pressed", "false");
  });

  test("submit with valid data shows success message", async ({ feedbackPage }) => {
    const feedbackSubmission = await mockFeedbackSubmission(feedbackPage);
    const dialog = await openFeedbackDialog(feedbackPage);

    const emailInput = dialog.getByRole("textbox", { name: /email address/iu });
    const messageInput = dialog.getByRole("textbox", { name: /^message$/iu });

    await expect(emailInput).toBeEnabled();
    await expect(messageInput).toBeEnabled();

    await emailInput.click();
    await emailInput.fill("test@example.com");
    await messageInput.click();
    await messageInput.fill("This is test feedback");
    await dialog.getByRole("button", { name: /send message/iu }).click();

    await expect(dialog.getByText(/message sent successfully/iu)).toBeVisible();

    await expect(feedbackSubmission.requestBody).resolves.toStrictEqual({
      email: "test@example.com",
      message: "This is test feedback",
    });
  });

  test("submit with invalid email shows validation error", async ({ feedbackPage }) => {
    const dialog = await openFeedbackDialog(feedbackPage);

    const emailInput = dialog.getByRole("textbox", { name: /email address/iu });
    const messageInput = dialog.getByRole("textbox", { name: /^message$/iu });

    await expect(emailInput).toBeEnabled();
    await expect(messageInput).toBeEnabled();

    await emailInput.click();
    await emailInput.fill("invalid-email");
    await messageInput.click();
    await messageInput.fill("This is test feedback");
    await dialog.getByRole("button", { name: /send message/iu }).click();

    await expect(dialog).toBeVisible();
    await expect(emailInput).toBeFocused();
  });

  test("submit failure shows error message", async ({ feedbackPage }) => {
    const dialog = await openFeedbackDialog(feedbackPage);

    const emailInput = dialog.getByRole("textbox", { name: /email address/iu });
    const messageInput = dialog.getByRole("textbox", { name: /^message$/iu });

    await expect(emailInput).toBeEnabled();
    await expect(messageInput).toBeEnabled();

    await emailInput.click();
    await emailInput.fill("test@example.com");
    await messageInput.click();
    await messageInput.fill("   ");
    await dialog.getByRole("button", { name: /send message/iu }).click();

    await expect(dialog.getByText(/failed to send message/iu)).toBeVisible();
  });
});

test.describe("Content Feedback - Authenticated", () => {
  test("email field shows authenticated user's email", async ({ feedbackPage, feedbackUser }) => {
    await openCompletedLessonFeedback(feedbackPage);
    const dialog = await openFeedbackDialog(feedbackPage);

    const emailInput = dialog.getByRole("textbox", { name: /email address/iu });

    await expect(emailInput).toBeEnabled();

    await expect(emailInput).toHaveValue(
      new RegExp(feedbackUser.email.replaceAll(/[.]/gu, String.raw`\.`), "u"),
    );
  });
});

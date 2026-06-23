import { randomUUID } from "node:crypto";
import { type Page } from "@playwright/test";
import { openDialog } from "@zoonk/e2e/fixtures/dialog";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { mockFeedbackSubmission } from "./feedback";
import { expect, test } from "./fixtures";

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

  const dailyRecordHeading = page.getByRole("heading", { name: /daily record/iu });

  if (await dailyRecordHeading.isVisible()) {
    const continueButton = page.getByRole("button", { name: /continue/iu });
    await expect(continueButton).toBeVisible();
    await continueButton.click();
  }

  await expect(page.getByRole("button", { name: /send feedback/iu })).toBeVisible();
}

test.describe("Content Feedback", () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await openCompletedLessonFeedback(authenticatedPage);
  });

  test("clicking feedback button marks it as pressed", async ({ authenticatedPage }) => {
    const thumbsUp = authenticatedPage.getByRole("button", { name: /i liked it/iu });
    const thumbsDown = authenticatedPage.getByRole("button", { name: /i didn't like it/iu });

    await expect(thumbsUp).toHaveAttribute("aria-pressed", "false");
    await expect(thumbsDown).toHaveAttribute("aria-pressed", "false");

    await thumbsUp.click();
    await expect(thumbsUp).toHaveAttribute("aria-pressed", "true");
    await expect(thumbsDown).toHaveAttribute("aria-pressed", "false");

    await thumbsDown.click();
    await expect(thumbsDown).toHaveAttribute("aria-pressed", "true");
    await expect(thumbsUp).toHaveAttribute("aria-pressed", "false");
  });

  test("submit with valid data shows success message", async ({ authenticatedPage }) => {
    const feedbackSubmission = await mockFeedbackSubmission(authenticatedPage);

    const feedbackButton = authenticatedPage.getByRole("button", { name: /send feedback/iu });
    const dialog = authenticatedPage.getByRole("dialog");
    await openDialog(feedbackButton, dialog);

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

  test("submit with invalid email shows validation error", async ({ authenticatedPage }) => {
    const feedbackButton = authenticatedPage.getByRole("button", { name: /send feedback/iu });
    const dialog = authenticatedPage.getByRole("dialog");
    await openDialog(feedbackButton, dialog);

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

  test("submit failure shows error message", async ({ authenticatedPage }) => {
    const feedbackButton = authenticatedPage.getByRole("button", { name: /send feedback/iu });
    const dialog = authenticatedPage.getByRole("dialog");
    await openDialog(feedbackButton, dialog);

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
  test("email field shows authenticated user's email", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    await openCompletedLessonFeedback(authenticatedPage);

    const feedbackButton = authenticatedPage.getByRole("button", { name: /send feedback/iu });
    const dialog = authenticatedPage.getByRole("dialog");
    await openDialog(feedbackButton, dialog);

    const emailInput = dialog.getByRole("textbox", { name: /email address/iu });

    await expect(emailInput).toBeEnabled();

    await expect(emailInput).toHaveValue(
      new RegExp(withProgressUser.email.replaceAll(/[.]/gu, String.raw`\.`), "u"),
    );
  });
});

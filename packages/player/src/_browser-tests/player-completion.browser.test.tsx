import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { buildSerializedLesson, buildSerializedStep } from "../_test-utils/player-test-data";
import { buildAuthenticatedViewer } from "../_test-utils/player-test-viewer";
import { buildNavigation, renderPlayer } from "../_test-utils/render-player";

/**
 * Completion browser tests all start from the same one-step quiz because it is
 * the smallest lesson that reaches the shared completion screen while still
 * producing a real score. Keeping that shape in one place lets
 * each scenario focus on the completion branch it is verifying.
 */
function buildCompletionQuizLesson({
  correctText = "Correct answer",
  question = "Completion question",
  wrongText = "Wrong answer",
}: { correctText?: string; question?: string; wrongText?: string } = {}) {
  return buildSerializedLesson({
    kind: "quiz",
    steps: [
      buildSerializedStep({
        content: {
          options: [
            { feedback: "Correct!", id: "correct", isCorrect: true, text: correctText },
            { feedback: "Not this one", id: "wrong", isCorrect: false, text: wrongText },
          ],
          question,
        },
        id: "completion-step",
        kind: "multipleChoice",
      }),
    ],
  });
}

/**
 * Reaching completion through the public UI path matters here because the
 * shared package is responsible for the full transition: answer selection,
 * feedback, completion scoring, and the final completion chrome. This helper
 * avoids seeding fake completed state and proves the real workflow still works.
 */
async function completeSingleChoiceLesson({
  optionName = "Correct answer",
}: { optionName?: string } = {}) {
  await page.getByRole("radio", { name: optionName }).click();
  await page.getByRole("button", { name: /check/iu }).click();
  await page.getByRole("button", { name: /continue/iu }).click();
}

describe("player browser integration: completion", () => {
  it("renders authenticated lesson completion progress, actions, footer, and hidden chrome", async () => {
    renderPlayer({
      lesson: buildCompletionQuizLesson(),
      lessonProgress: {
        currentLessonNumber: 2,
        remainingChaptersInCourse: 1,
        remainingLessonsInChapter: 3,
        totalLessonsInChapter: 5,
      },
      navigation: buildNavigation({ nextLessonHref: "/lesson/play" }),
      totalBrainPower: 0,
      viewer: buildAuthenticatedViewer({ completionFooter: <p>Custom completion footer</p> }),
    });

    await expect.element(page.getByRole("link", { name: /close/iu })).toBeInTheDocument();

    await expect
      .element(page.getByRole("progressbar", { name: /lesson progress/iu }))
      .toBeInTheDocument();

    await completeSingleChoiceLesson();

    const completionScreen = page.getByRole("status");

    await expect.element(completionScreen.getByText("1/1")).toBeInTheDocument();
    await expect.element(completionScreen.getByText("Lesson 2 of 5")).toBeInTheDocument();

    const chapterProgress = completionScreen.getByRole("progressbar", {
      name: /chapter progress/iu,
    });

    await expect.element(chapterProgress).toBeInTheDocument();
    await expect.element(chapterProgress).toHaveAttribute("aria-valuenow", "40");

    await expect
      .element(completionScreen.getByText(/lessons left in this chapter/iu))
      .not.toBeInTheDocument();

    await expect.element(completionScreen.getByText(/\+10\s*BP/iu)).not.toBeInTheDocument();

    await expect
      .element(completionScreen.getByRole("progressbar", { name: /level progress/iu }))
      .not.toBeInTheDocument();

    await expect.element(completionScreen.getByText(/belt/iu)).not.toBeInTheDocument();

    await expect.element(completionScreen.getByRole("link", { name: "Next" })).toBeInTheDocument();

    await expect
      .element(completionScreen.getByRole("link", { name: /all lessons/iu }))
      .toBeInTheDocument();

    await expect
      .element(completionScreen.getByRole("button", { name: /try again/iu }))
      .toBeInTheDocument();

    await expect.element(page.getByText("Custom completion footer")).toBeInTheDocument();
    await expect.element(page.getByRole("link", { name: /close/iu })).not.toBeInTheDocument();

    await expect
      .element(page.getByRole("progressbar", { name: /lesson progress/iu }))
      .not.toBeInTheDocument();

    await completionScreen.getByRole("button", { name: /try again/iu }).click();

    await expect
      .element(page.getByRole("heading", { name: "Completion question" }))
      .toBeInTheDocument();

    await expect.element(page.getByRole("link", { name: /close/iu })).toBeInTheDocument();
  });

  it("shows a belt level milestone before the ordinary completion summary", async () => {
    renderPlayer({
      lesson: buildCompletionQuizLesson(),
      navigation: buildNavigation({ levelHref: "/level", nextLessonHref: "/lesson/play" }),
      totalBrainPower: 240,
      viewer: buildAuthenticatedViewer(),
    });

    await completeSingleChoiceLesson();

    const milestoneScreen = page.getByRole("status");

    await expect.element(milestoneScreen.getByText(/brain power up/iu)).toBeInTheDocument();

    await expect.element(milestoneScreen.getByText(/your brain power is up/iu)).toBeInTheDocument();

    await expect
      .element(milestoneScreen.getByRole("link", { name: /learn about levels/iu }))
      .toHaveAttribute("href", "/level");

    await expect.element(milestoneScreen.getByText("1/1")).not.toBeInTheDocument();

    await milestoneScreen.getByRole("button", { name: /continue/iu }).click();

    const completionScreen = page.getByRole("status");

    await expect.element(completionScreen.getByText("1/1")).toBeInTheDocument();
    await expect.element(completionScreen.getByText(/\+10\s*BP/iu)).not.toBeInTheDocument();

    await expect.element(completionScreen.getByRole("link", { name: "Next" })).toBeInTheDocument();
  });

  it("shows a halfway level milestone before the ordinary completion summary", async () => {
    renderPlayer({
      lesson: buildCompletionQuizLesson(),
      navigation: buildNavigation({ levelHref: "/level", nextLessonHref: "/lesson/play" }),
      totalBrainPower: 120,
      viewer: buildAuthenticatedViewer(),
    });

    await completeSingleChoiceLesson();

    const milestoneScreen = page.getByRole("status");

    await expect
      .element(milestoneScreen.getByText(/halfway to your next level/iu))
      .toBeInTheDocument();

    await expect.element(milestoneScreen.getByText(/complete/iu)).toBeInTheDocument();

    await milestoneScreen.getByRole("button", { name: /continue/iu }).click();

    await expect
      .element(page.getByRole("status").getByRole("link", { name: "Next" }))
      .toBeInTheDocument();
  });

  it("omits next lesson and level progress when optional lesson links are missing", async () => {
    renderPlayer({
      lesson: buildCompletionQuizLesson(),
      navigation: buildNavigation({ levelHref: undefined, nextLessonHref: null }),
      viewer: buildAuthenticatedViewer(),
    });

    await completeSingleChoiceLesson();

    const completionScreen = page.getByRole("status");

    await expect.element(completionScreen.getByText(/\+10\s*BP/iu)).not.toBeInTheDocument();

    await expect
      .element(completionScreen.getByRole("link", { name: /all lessons/iu }))
      .toBeInTheDocument();

    await expect
      .element(completionScreen.getByRole("button", { name: /try again/iu }))
      .toBeInTheDocument();

    await expect
      .element(completionScreen.getByRole("link", { name: "Next" }))
      .not.toBeInTheDocument();

    await expect
      .element(completionScreen.getByRole("progressbar", { name: /level progress/iu }))
      .not.toBeInTheDocument();

    await expect.element(completionScreen.getByText(/belt/iu)).not.toBeInTheDocument();
  });

  it("shows guest lesson completion login prompt without rewards and falls back to /login", async () => {
    renderPlayer({
      lesson: buildCompletionQuizLesson(),
      navigation: buildNavigation({ loginHref: undefined, nextLessonHref: "/lesson/play" }),
      viewer: { isAuthenticated: false, userName: null },
    });

    await completeSingleChoiceLesson();

    const completionScreen = page.getByRole("status");

    const loginLink = completionScreen.getByRole("link", {
      name: /log in to save your progress/iu,
    });

    const nextLink = completionScreen.getByRole("link", { name: "Next" });

    await expect.element(completionScreen.getByText("1/1")).toBeInTheDocument();

    await expect
      .element(completionScreen.getByText(/sign up to track your progress/iu))
      .toBeInTheDocument();

    await expect.element(nextLink).toBeInTheDocument();
    await expect.element(nextLink).toHaveAttribute("href", "/lesson/play");
    await expect.element(loginLink).toBeInTheDocument();
    await expect.element(loginLink).toHaveAttribute("href", "/login");

    await expect
      .element(completionScreen.getByRole("link", { name: /all lessons/iu }))
      .toBeInTheDocument();

    await expect
      .element(completionScreen.getByRole("button", { name: /try again/iu }))
      .toBeInTheDocument();

    await expect.element(completionScreen.getByText(/\+10\s*BP/iu)).not.toBeInTheDocument();

    await expect
      .element(completionScreen.getByRole("progressbar", { name: /level progress/iu }))
      .not.toBeInTheDocument();
  });

  it("falls back to review-only chapter completion when there is no next chapter", async () => {
    renderPlayer({
      lesson: buildCompletionQuizLesson(),
      milestone: { kind: "chapter", nextHref: null, reviewHref: "/review-chapter" },
      viewer: buildAuthenticatedViewer(),
    });

    await completeSingleChoiceLesson();

    const completionScreen = page.getByRole("status");

    await expect.element(completionScreen.getByText(/chapter complete/iu)).toBeInTheDocument();

    await expect
      .element(completionScreen.getByRole("link", { name: /review chapter/iu }))
      .toBeInTheDocument();

    await expect
      .element(completionScreen.getByRole("link", { name: /next chapter/iu }))
      .not.toBeInTheDocument();
  });

  it("renders course completion review actions", async () => {
    renderPlayer({
      lesson: buildCompletionQuizLesson(),
      milestone: {
        kind: "course",
        reviewHref: "/review-course",
        secondaryReviewHref: "/review-chapter",
      },
      viewer: buildAuthenticatedViewer(),
    });

    await completeSingleChoiceLesson();

    const completionScreen = page.getByRole("status");

    await expect.element(completionScreen.getByText(/course complete/iu)).toBeInTheDocument();

    await expect
      .element(completionScreen.getByRole("link", { name: /review course/iu }))
      .toBeInTheDocument();

    await expect
      .element(completionScreen.getByRole("link", { name: /review chapter/iu }))
      .toBeInTheDocument();
  });

  it("shows guest milestone actions without exposing authenticated next links", async () => {
    renderPlayer({
      lesson: buildCompletionQuizLesson(),
      milestone: { kind: "chapter", nextHref: "/next-chapter", reviewHref: "/review-chapter" },
      navigation: buildNavigation({ loginHref: "/sign-in" }),
      viewer: { isAuthenticated: false, userName: null },
    });

    await completeSingleChoiceLesson();

    const completionScreen = page.getByRole("status");

    const loginLink = completionScreen.getByRole("link", {
      name: /log in to save your progress/iu,
    });

    await expect
      .element(completionScreen.getByText(/sign up to track your progress/iu))
      .toBeInTheDocument();

    await expect.element(loginLink).toHaveAttribute("href", "/sign-in");

    await expect
      .element(completionScreen.getByRole("link", { name: /review chapter/iu }))
      .toBeInTheDocument();

    await expect
      .element(completionScreen.getByRole("link", { name: /next chapter/iu }))
      .not.toBeInTheDocument();
  });
});

import { describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import { buildSerializedLesson, buildSerializedStep } from "../_test-utils/player-test-data";
import { buildAuthenticatedViewer } from "../_test-utils/player-test-viewer";
import { buildNavigation, renderPlayer } from "../_test-utils/render-player";

/**
 * Completion browser tests all start from the same one-step quiz because it is
 * the smallest lesson that reaches the shared completion screen while still
 * producing a real score and rewards. Keeping that shape in one place lets
 * each scenario focus on the completion branch it is verifying.
 */
function buildCompletionQuizLesson({
  correctText = "Correct answer",
  question = "Completion question",
  wrongText = "Wrong answer",
}: {
  correctText?: string;
  question?: string;
  wrongText?: string;
} = {}) {
  return buildSerializedLesson({
    kind: "quiz",
    steps: [
      buildSerializedStep({
        content: {
          kind: "core" as const,
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
}: {
  optionName?: string;
} = {}) {
  await page.getByRole("radio", { name: optionName }).click();
  await page.getByRole("button", { name: /check/i }).click();
  await page.getByRole("button", { name: /continue/i }).click();
}

describe("player browser integration: completion", () => {
  test("renders authenticated lesson completion rewards, actions, footer, and hidden chrome", async () => {
    renderPlayer({
      lesson: buildCompletionQuizLesson(),
      navigation: buildNavigation({ nextLessonHref: "/lesson/play" }),
      totalBrainPower: 240,
      viewer: buildAuthenticatedViewer({
        completionFooter: <p>Custom completion footer</p>,
      }),
    });

    await expect.element(page.getByRole("link", { name: /close/i })).toBeInTheDocument();
    await expect
      .element(page.getByRole("progressbar", { name: /lesson progress/i }))
      .toBeInTheDocument();

    await completeSingleChoiceLesson();

    const completionScreen = page.getByRole("status");

    await expect.element(completionScreen.getByText("1/1")).toBeInTheDocument();
    await expect.element(completionScreen.getByText(/\+10\s*BP/i)).toBeInTheDocument();
    await expect
      .element(completionScreen.getByRole("progressbar", { name: /level progress/i }))
      .toBeInTheDocument();
    await expect.element(completionScreen.getByRole("link", { name: "Next" })).toBeInTheDocument();
    await expect
      .element(completionScreen.getByRole("link", { name: /all lessons/i }))
      .toBeInTheDocument();
    await expect
      .element(completionScreen.getByRole("button", { name: /try again/i }))
      .toBeInTheDocument();
    await expect.element(page.getByText("Custom completion footer")).toBeInTheDocument();
    await expect.element(page.getByRole("link", { name: /close/i })).not.toBeInTheDocument();
    await expect
      .element(page.getByRole("progressbar", { name: /lesson progress/i }))
      .not.toBeInTheDocument();

    await completionScreen.getByRole("button", { name: /try again/i }).click();

    await expect
      .element(page.getByRole("heading", { name: "Completion question" }))
      .toBeInTheDocument();
    await expect.element(page.getByRole("link", { name: /close/i })).toBeInTheDocument();
  });

  test("omits next lesson and level progress when optional lesson links are missing", async () => {
    renderPlayer({
      lesson: buildCompletionQuizLesson(),
      navigation: buildNavigation({ levelHref: undefined, nextLessonHref: null }),
      viewer: buildAuthenticatedViewer(),
    });

    await completeSingleChoiceLesson();

    const completionScreen = page.getByRole("status");

    await expect.element(completionScreen.getByText(/\+10\s*BP/i)).toBeInTheDocument();
    await expect
      .element(completionScreen.getByRole("link", { name: /all lessons/i }))
      .toBeInTheDocument();
    await expect
      .element(completionScreen.getByRole("button", { name: /try again/i }))
      .toBeInTheDocument();
    await expect
      .element(completionScreen.getByRole("link", { name: "Next" }))
      .not.toBeInTheDocument();
    await expect
      .element(completionScreen.getByRole("progressbar", { name: /level progress/i }))
      .not.toBeInTheDocument();
    await expect.element(completionScreen.getByText(/belt/i)).not.toBeInTheDocument();
  });

  test("shows guest lesson completion login prompt without rewards and falls back to /login", async () => {
    renderPlayer({
      lesson: buildCompletionQuizLesson(),
      navigation: buildNavigation({ loginHref: undefined, nextLessonHref: "/lesson/play" }),
      viewer: { isAuthenticated: false, userName: null },
    });

    await completeSingleChoiceLesson();

    const completionScreen = page.getByRole("status");
    const loginLink = completionScreen.getByRole("link", { name: /login/i });
    const nextLink = completionScreen.getByRole("link", { name: "Next" });

    await expect.element(completionScreen.getByText("1/1")).toBeInTheDocument();
    await expect
      .element(completionScreen.getByText(/sign up to track your progress/i))
      .toBeInTheDocument();
    await expect.element(nextLink).toBeInTheDocument();
    await expect.element(nextLink).toHaveAttribute("href", "/lesson/play");
    await expect.element(loginLink).toBeInTheDocument();
    await expect.element(loginLink).toHaveAttribute("href", "/login");
    await expect
      .element(completionScreen.getByRole("link", { name: /all lessons/i }))
      .toBeInTheDocument();
    await expect
      .element(completionScreen.getByRole("button", { name: /try again/i }))
      .toBeInTheDocument();
    await expect.element(completionScreen.getByText(/\+10\s*BP/i)).not.toBeInTheDocument();
    await expect
      .element(completionScreen.getByRole("progressbar", { name: /level progress/i }))
      .not.toBeInTheDocument();
  });

  test("falls back to review-only chapter completion when there is no next chapter", async () => {
    renderPlayer({
      lesson: buildCompletionQuizLesson(),
      milestone: {
        kind: "chapter",
        nextHref: null,
        reviewHref: "/review-chapter",
      },
      viewer: buildAuthenticatedViewer(),
    });

    await completeSingleChoiceLesson();

    const completionScreen = page.getByRole("status");

    await expect.element(completionScreen.getByText(/chapter complete/i)).toBeInTheDocument();
    await expect
      .element(completionScreen.getByRole("link", { name: /review chapter/i }))
      .toBeInTheDocument();
    await expect
      .element(completionScreen.getByRole("link", { name: /next chapter/i }))
      .not.toBeInTheDocument();
  });

  test("renders course completion review actions", async () => {
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

    await expect.element(completionScreen.getByText(/course complete/i)).toBeInTheDocument();
    await expect
      .element(completionScreen.getByRole("link", { name: /review course/i }))
      .toBeInTheDocument();
    await expect
      .element(completionScreen.getByRole("link", { name: /review chapter/i }))
      .toBeInTheDocument();
  });

  test("shows guest milestone actions without exposing authenticated next links", async () => {
    renderPlayer({
      lesson: buildCompletionQuizLesson(),
      milestone: {
        kind: "chapter",
        nextHref: "/next-chapter",
        reviewHref: "/review-chapter",
      },
      navigation: buildNavigation({ loginHref: "/sign-in" }),
      viewer: { isAuthenticated: false, userName: null },
    });

    await completeSingleChoiceLesson();

    const completionScreen = page.getByRole("status");
    const loginLink = completionScreen.getByRole("link", { name: /login/i });

    await expect
      .element(completionScreen.getByText(/sign up to track your progress/i))
      .toBeInTheDocument();
    await expect.element(loginLink).toHaveAttribute("href", "/sign-in");
    await expect
      .element(completionScreen.getByRole("link", { name: /review chapter/i }))
      .toBeInTheDocument();
    await expect
      .element(completionScreen.getByRole("link", { name: /next chapter/i }))
      .not.toBeInTheDocument();
  });
});

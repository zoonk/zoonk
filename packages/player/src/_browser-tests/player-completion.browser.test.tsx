import { describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import { buildSerializedActivity, buildSerializedStep } from "../_test-utils/player-test-data";
import { buildAuthenticatedViewer } from "../_test-utils/player-test-viewer";
import { buildNavigation, renderPlayer } from "../_test-utils/render-player";

/**
 * Completion browser tests all start from the same one-step quiz because it is
 * the smallest activity that reaches the shared completion screen while still
 * producing a real score and rewards. Keeping that shape in one place lets
 * each scenario focus on the completion branch it is verifying.
 */
function buildCompletionQuizActivity({
  correctText = "Correct answer",
  question = "Completion question",
  wrongText = "Wrong answer",
}: {
  correctText?: string;
  question?: string;
  wrongText?: string;
} = {}) {
  return buildSerializedActivity({
    kind: "quiz",
    steps: [
      buildSerializedStep({
        content: {
          kind: "core" as const,
          options: [
            { feedback: "Correct!", isCorrect: true, text: correctText },
            { feedback: "Not this one", isCorrect: false, text: wrongText },
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
async function completeSingleChoiceActivity({
  optionName = "Correct answer",
}: {
  optionName?: string;
} = {}) {
  await page.getByRole("radio", { name: optionName }).click();
  await page.getByRole("button", { name: /check/i }).click();
  await page.getByRole("button", { name: /continue/i }).click();
}

describe("player browser integration: completion", () => {
  test("renders authenticated activity completion rewards, actions, footer, and hidden chrome", async () => {
    renderPlayer({
      activity: buildCompletionQuizActivity(),
      navigation: buildNavigation({ nextActivityHref: "/lesson/a/2" }),
      totalBrainPower: 240,
      viewer: buildAuthenticatedViewer({
        completionFooter: <p>Custom completion footer</p>,
      }),
    });

    await expect.element(page.getByRole("link", { name: /close/i })).toBeInTheDocument();
    await expect
      .element(page.getByRole("progressbar", { name: /activity progress/i }))
      .toBeInTheDocument();

    await completeSingleChoiceActivity();

    const completionScreen = page.getByRole("status");

    await expect.element(completionScreen.getByText("1/1")).toBeInTheDocument();
    await expect.element(completionScreen.getByText(/\+10\s*BP/i)).toBeInTheDocument();
    await expect
      .element(completionScreen.getByRole("progressbar", { name: /level progress/i }))
      .toBeInTheDocument();
    await expect.element(completionScreen.getByRole("link", { name: "Next" })).toBeInTheDocument();
    await expect
      .element(completionScreen.getByRole("link", { name: /all activities/i }))
      .toBeInTheDocument();
    await expect
      .element(completionScreen.getByRole("button", { name: /try again/i }))
      .toBeInTheDocument();
    await expect.element(page.getByText("Custom completion footer")).toBeInTheDocument();
    await expect.element(page.getByRole("link", { name: /close/i })).not.toBeInTheDocument();
    await expect
      .element(page.getByRole("progressbar", { name: /activity progress/i }))
      .not.toBeInTheDocument();

    await completionScreen.getByRole("button", { name: /try again/i }).click();

    await expect
      .element(page.getByRole("heading", { name: "Completion question" }))
      .toBeInTheDocument();
    await expect.element(page.getByRole("link", { name: /close/i })).toBeInTheDocument();
  });

  test("omits next activity and level progress when optional activity links are missing", async () => {
    renderPlayer({
      activity: buildCompletionQuizActivity(),
      navigation: buildNavigation({ levelHref: undefined, nextActivityHref: null }),
      viewer: buildAuthenticatedViewer(),
    });

    await completeSingleChoiceActivity();

    const completionScreen = page.getByRole("status");

    await expect.element(completionScreen.getByText(/\+10\s*BP/i)).toBeInTheDocument();
    await expect
      .element(completionScreen.getByRole("link", { name: /all activities/i }))
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

  test("shows guest activity completion login prompt without rewards and falls back to /login", async () => {
    renderPlayer({
      activity: buildCompletionQuizActivity(),
      navigation: buildNavigation({ loginHref: undefined }),
      viewer: { isAuthenticated: false, userName: null },
    });

    await completeSingleChoiceActivity();

    const completionScreen = page.getByRole("status");
    const loginLink = completionScreen.getByRole("link", { name: /login/i });

    await expect.element(completionScreen.getByText("1/1")).toBeInTheDocument();
    await expect
      .element(completionScreen.getByText(/sign up to track your progress/i))
      .toBeInTheDocument();
    await expect.element(loginLink).toBeInTheDocument();
    await expect.element(loginLink).toHaveAttribute("href", "/login");
    await expect
      .element(completionScreen.getByRole("link", { name: /all activities/i }))
      .toBeInTheDocument();
    await expect
      .element(completionScreen.getByRole("button", { name: /try again/i }))
      .toBeInTheDocument();
    await expect.element(completionScreen.getByText(/\+10\s*BP/i)).not.toBeInTheDocument();
    await expect
      .element(completionScreen.getByRole("progressbar", { name: /level progress/i }))
      .not.toBeInTheDocument();
  });

  test("renders lesson completion milestone actions without score, rewards, or footer", async () => {
    renderPlayer({
      activity: buildCompletionQuizActivity(),
      milestone: {
        kind: "lesson",
        nextHref: "/next-lesson",
        reviewHref: "/review-lesson",
      },
      viewer: buildAuthenticatedViewer({
        completionFooter: <p>Only activity completions render this footer</p>,
      }),
    });

    await completeSingleChoiceActivity();

    const completionScreen = page.getByRole("status");

    await expect.element(completionScreen.getByText(/lesson complete/i)).toBeInTheDocument();
    await expect
      .element(completionScreen.getByRole("link", { name: /next lesson/i }))
      .toBeInTheDocument();
    await expect
      .element(completionScreen.getByRole("link", { name: /review lesson/i }))
      .toBeInTheDocument();
    await expect.element(completionScreen.getByText("1/1")).not.toBeInTheDocument();
    await expect.element(completionScreen.getByText(/\+10\s*BP/i)).not.toBeInTheDocument();
    await expect
      .element(page.getByText("Only activity completions render this footer"))
      .not.toBeInTheDocument();
  });

  test("falls back to review-only chapter completion when there is no next chapter", async () => {
    renderPlayer({
      activity: buildCompletionQuizActivity(),
      milestone: {
        kind: "chapter",
        nextHref: null,
        reviewHref: "/review-chapter",
      },
      viewer: buildAuthenticatedViewer(),
    });

    await completeSingleChoiceActivity();

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
      activity: buildCompletionQuizActivity(),
      milestone: {
        kind: "course",
        reviewHref: "/review-course",
        secondaryReviewHref: "/review-chapter",
      },
      viewer: buildAuthenticatedViewer(),
    });

    await completeSingleChoiceActivity();

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
      activity: buildCompletionQuizActivity(),
      milestone: {
        kind: "lesson",
        nextHref: "/next-lesson",
        reviewHref: "/review-lesson",
      },
      navigation: buildNavigation({ loginHref: "/sign-in" }),
      viewer: { isAuthenticated: false, userName: null },
    });

    await completeSingleChoiceActivity();

    const completionScreen = page.getByRole("status");
    const loginLink = completionScreen.getByRole("link", { name: /login/i });

    await expect
      .element(completionScreen.getByText(/sign up to track your progress/i))
      .toBeInTheDocument();
    await expect.element(loginLink).toHaveAttribute("href", "/sign-in");
    await expect
      .element(completionScreen.getByRole("link", { name: /review lesson/i }))
      .toBeInTheDocument();
    await expect
      .element(completionScreen.getByRole("link", { name: /next lesson/i }))
      .not.toBeInTheDocument();
  });
});

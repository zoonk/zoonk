import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import {
  runInMobilePlayerViewport,
  runInTabletLandscapePlayerViewport,
} from "../_test-utils/browser-viewport";
import { buildSerializedLesson, buildSerializedStep } from "../_test-utils/player-test-data";
import { renderPlayer } from "../_test-utils/render-player";

describe("player browser integration: lesson questions", () => {
  it("keeps the step question action available in the desktop navigation toolbar", async () => {
    await runInTabletLandscapePlayerViewport(async () => {
      const onAskQuestion = vi.fn();

      renderPlayer({
        lesson: buildSerializedLesson({
          steps: [
            buildSerializedStep({
              content: { text: "Read this explanation", title: "A useful idea", variant: "text" },
              id: "question-desktop-static-step",
            }),
          ],
        }),
        questionSupport: {
          canExplainAnswer: true,
          interactionState: "active",
          onAskQuestion,
          onExplainAnswer: vi.fn(),
        },
      });

      const lessonControls = page.getByRole("toolbar", { name: /lesson controls/iu });

      const askButton = lessonControls.getByRole("button", { name: /ask about this lesson/iu });

      await expect.element(askButton).toBeVisible();

      await expect
        .element(lessonControls.getByRole("button", { name: /^next step$/iu }))
        .toBeVisible();

      await askButton.click();

      expect(onAskQuestion).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "step", stepIndex: 0 }),
      );
    });
  });

  it("keeps the step question action beside Next on mobile", async () => {
    await runInMobilePlayerViewport(async () => {
      const onAskQuestion = vi.fn();

      renderPlayer({
        lesson: buildSerializedLesson({
          steps: [
            buildSerializedStep({
              content: { text: "Read this explanation", title: "A useful idea", variant: "text" },
              id: "question-static-step",
            }),
          ],
        }),
        questionSupport: {
          canExplainAnswer: true,
          interactionState: "active",
          onAskQuestion,
          onExplainAnswer: vi.fn(),
        },
      });

      const lessonControls = page.getByRole("toolbar", { name: /lesson controls/iu });

      const askButton = lessonControls.getByRole("button", { name: /ask about this lesson/iu });

      await expect.element(lessonControls.getByRole("button", { name: /^next$/iu })).toBeVisible();
      await expect.element(askButton).toBeVisible();
      await askButton.click();

      expect(onAskQuestion).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "step", stepIndex: 0 }),
      );
    });
  });

  it("replaces Ask with an automatic answer explanation after checking", async () => {
    await runInMobilePlayerViewport(async () => {
      const onExplainAnswer = vi.fn();

      renderPlayer({
        lesson: buildSerializedLesson({
          steps: [
            buildSerializedStep({
              content: {
                options: [
                  { feedback: "Exactly", id: "four", isCorrect: true, text: "4" },
                  { feedback: "Try again", id: "three", isCorrect: false, text: "3" },
                ],
                question: "What is 2 + 2?",
              },
              id: "question-choice-step",
              kind: "multipleChoice",
            }),
          ],
        }),
        questionSupport: {
          canExplainAnswer: true,
          interactionState: "active",
          onAskQuestion: vi.fn(),
          onExplainAnswer,
        },
      });

      await page.getByRole("radio", { name: "3" }).click();
      await page.getByRole("button", { name: /check/iu }).click();

      const lessonControls = page.getByRole("toolbar", { name: /lesson controls/iu });
      const explainButton = lessonControls.getByRole("button", { name: /explain answer/iu });

      await expect.element(explainButton).toBeVisible();

      await expect
        .element(lessonControls.getByRole("button", { name: /ask about this lesson/iu }))
        .not.toBeInTheDocument();

      await explainButton.click();

      expect(onExplainAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({ kind: "answer" }),
          question: "Why was my answer wrong? Explain the correct answer.",
        }),
      );
    });
  });

  it("reopens questions without starting an explanation while another answer is in progress", async () => {
    await runInMobilePlayerViewport(async () => {
      const onAskQuestion = vi.fn();
      const onExplainAnswer = vi.fn();

      renderPlayer({
        lesson: buildSerializedLesson({
          steps: [
            buildSerializedStep({
              content: {
                options: [
                  { feedback: "Exactly", id: "four", isCorrect: true, text: "4" },
                  { feedback: "Try again", id: "three", isCorrect: false, text: "3" },
                ],
                question: "What is 2 + 2?",
              },
              id: "question-disabled-explanation-step",
              kind: "multipleChoice",
            }),
          ],
        }),
        questionSupport: {
          canExplainAnswer: false,
          interactionState: "active",
          onAskQuestion,
          onExplainAnswer,
        },
      });

      await page.getByRole("radio", { name: "3" }).click();
      await page.getByRole("button", { name: /check/iu }).click();

      const openQuestions = page.getByRole("button", { name: /open questions/iu });

      await expect.element(openQuestions).toBeEnabled();
      await openQuestions.click();

      expect(onAskQuestion).toHaveBeenCalledWith(expect.objectContaining({ kind: "answer" }));
      expect(onExplainAnswer).not.toHaveBeenCalled();
    });
  });

  it("keeps the lesson question action beside the completion primary action", async () => {
    const onAskQuestion = vi.fn();

    renderPlayer({
      lesson: buildSerializedLesson({
        steps: [
          buildSerializedStep({
            content: { text: "One final idea", title: "Finish", variant: "text" },
            id: "question-completion-step",
          }),
        ],
      }),
      questionSupport: {
        canExplainAnswer: true,
        interactionState: "active",
        onAskQuestion,
        onExplainAnswer: vi.fn(),
      },
    });

    await page.getByRole("button", { name: /^next step$/iu }).click();

    const completion = page.getByRole("status");
    await expect.element(completion.getByRole("link", { name: /next/iu })).toBeVisible();

    const askButton = completion.getByRole("button", { name: /ask about this lesson/iu });
    await expect.element(askButton).toBeVisible();
    await askButton.click();

    expect(onAskQuestion).toHaveBeenCalledWith({ kind: "lesson" });
  });
});

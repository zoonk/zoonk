import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import {
  buildAdapters,
  renderLessonPlayer,
  runAnswer,
  startedRun,
} from "../_test-utils/render-lesson-player";
import { CANT_WRITE_TODAY, isChosenToday, setChosenToday } from "../lesson/use-today-choice";
import { buildLesson, localAdapters } from "../preview/preview-lesson";
import { contentStep, teachingStep } from "../preview/preview-steps";

const SAMPLE_ANSWER =
  "Because we can't pin down where the electron is. The cloud maps where it's most likely to be.";

/** An explanation in the learner's own words: no accepted wordings to match, only key points. */
function explanationStep() {
  return contentStep("typedAnswer", {
    content: {
      ...playableStepContent.typedAnswer,
      acceptedAnswers: [],
      question: "In one or two sentences, say why the electron is drawn as a cloud.",
    },
  });
}

function verdict(text: string) {
  return page.getByRole("status").filter({ hasText: text });
}

function writingSkippedNotice() {
  return page.getByRole("status").filter({ hasText: "No more writing today." });
}

describe("open answer skip", () => {
  it("explains first while the explanation is ahead, then shows a good answer without grading", async () => {
    const first = explanationStep();
    const last = explanationStep();
    const lesson = buildLesson([first, teachingStep("explanation"), last]);
    const local = localAdapters(lesson);

    const adapters = buildAdapters(lesson, {
      completeLesson: vi.fn(async (input) => {
        const result = await local.completeLesson(input);

        return result.status === "completed"
          ? { ...result, completion: { ...result.completion, correctCount: 0 } }
          : result;
      }),
    });

    renderLessonPlayer({ adapters, lesson });

    // Two ways out at most: the explanation still ahead takes the place of "I don't know yet".
    await expect.element(page.getByText("In your own words")).toBeVisible();
    await expect.element(page.getByRole("button", { name: /^Check/u })).toBeDisabled();
    await expect.element(page.getByRole("button", { name: "Can't write now" })).toBeVisible();

    await expect
      .element(page.getByRole("button", { name: "I don't know yet" }))
      .not.toBeInTheDocument();

    await page.getByRole("button", { name: "Explain first" }).click();
    await expect.element(page.getByText("A cloud, not a little ball")).toBeVisible();
    await page.getByRole("button", { name: /^Next/u }).click();
    await expect.element(page.getByRole("textbox")).toBeVisible();

    await page.getByRole("button", { name: "I don't know yet" }).click();

    // What a good answer says, before going on: no verdict on an answer the learner didn't give.
    await expect.element(verdict("Here's a good answer")).toBeVisible();
    await expect.element(verdict(SAMPLE_ANSWER)).toBeVisible();
    await expect.element(verdict("Not quite")).not.toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: /^Continue/u })).toHaveFocus();

    await page.getByRole("button", { name: /^Continue/u }).click();
    await expect.element(page.getByRole("textbox")).toBeVisible();
    await page.getByRole("textbox").fill("An unfinished thought");
    await page.getByRole("button", { name: "I don't know yet" }).click();
    await expect.element(verdict(SAMPLE_ANSWER)).toBeVisible();
    await page.getByRole("button", { name: /^Continue/u }).click();

    await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();
    await expect.element(page.getByText("1 of 1 right")).not.toBeInTheDocument();
    expect(adapters.checkStep).not.toHaveBeenCalled();

    expect(adapters.completeLesson).toHaveBeenCalledExactlyOnceWith({
      runId: expect.any(String),
      skippedWritingStepIds: [first.id, last.id],
    });
  });

  it.each([
    { kind: "a lesson", overrides: {} },
    { kind: "a language lesson", overrides: { language: "pt", targetLanguage: "en" } },
  ] as const)(
    "leaves the writing out of $kind with Can't write now, unchecked, and of every lesson today",
    async ({ overrides }) => {
      const first = explanationStep();
      const second = explanationStep();

      const lesson = buildLesson(
        [first, teachingStep("explanation"), second, teachingStep("summary")],
        overrides,
      );

      const adapters = buildAdapters(lesson);
      const { unmount } = renderLessonPlayer({ adapters, lesson });
      const skip = page.getByRole("button", { name: "Can't write now" });

      await expect.element(skip).toBeVisible();
      await skip.click();
      await expect.element(page.getByRole("textbox")).not.toBeInTheDocument();

      // The screen after it says writing is off for the day, and the keyboard stays in the lesson
      // instead of falling back to the page with the button that left.
      await expect.element(writingSkippedNotice()).toBeVisible();
      await expect.element(page.getByRole("button", { name: "Write again" })).toBeVisible();
      await expect.element(page.getByRole("button", { name: /^Next/u })).toHaveFocus();

      await page.getByRole("button", { name: /^Next/u }).click();
      await expect.element(page.getByRole("heading", { name: "Summary" })).toBeVisible();
      await expect.element(writingSkippedNotice()).not.toBeInTheDocument();
      await page.getByRole("button", { name: /^Continue/u }).click();
      await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();
      expect(adapters.checkStep).not.toHaveBeenCalled();

      expect(adapters.completeLesson).toHaveBeenCalledExactlyOnceWith({
        runId: expect.any(String),
        skippedWritingStepIds: [first.id, second.id],
      });

      // The next lesson today leaves its writing out as it opens, and says so on its first screen.
      unmount();
      renderLessonPlayer({ lesson });
      await expect.element(writingSkippedNotice()).toBeVisible();
      await expect.element(page.getByText("A cloud, not a little ball")).toBeVisible();
      await expect.element(page.getByRole("textbox")).not.toBeInTheDocument();
    },
  );

  it("puts the writing back with Write again, for this lesson and the rest of today", async () => {
    const writing = explanationStep();
    const lesson = buildLesson([teachingStep("explanation"), writing, teachingStep("summary")]);
    const earlier = renderLessonPlayer({ lesson: buildLesson([explanationStep()]) });

    // Earlier today, in another lesson.
    await page.getByRole("button", { name: "Can't write now" }).click();
    earlier.unmount();

    const { unmount } = renderLessonPlayer({ lesson });
    await expect.element(writingSkippedNotice()).toBeVisible();

    await page.getByRole("button", { name: "Write again" }).click();
    await expect.element(writingSkippedNotice()).not.toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: /^Next/u })).toHaveFocus();
    expect(isChosenToday(CANT_WRITE_TODAY)).toBe(false);

    await page.getByRole("button", { name: /^Next/u }).click();
    await expect.element(page.getByRole("textbox")).toBeVisible();

    // The next lesson asks for writing again.
    unmount();
    renderLessonPlayer({ lesson: buildLesson([writing]) });
    await expect.element(page.getByRole("textbox")).toBeVisible();
    await expect.element(writingSkippedNotice()).not.toBeInTheDocument();
  });

  it("keeps Write again after run start reconciles progress newer than the page", async () => {
    const quiz = teachingStep("check");
    const writing = explanationStep();

    const lesson = buildLesson([
      quiz,
      writing,
      teachingStep("explanation"),
      teachingStep("summary"),
    ]);

    const adapters = buildAdapters(lesson, {
      startLesson: () => Promise.resolve(startedRun({ answers: [runAnswer({ stepId: quiz.id })] })),
    });

    setChosenToday(CANT_WRITE_TODAY, true);
    renderLessonPlayer({ adapters, lesson });

    await expect.element(page.getByText("A cloud, not a little ball")).toBeVisible();
    await expect.element(writingSkippedNotice()).toBeVisible();
    await page.getByRole("button", { name: "Write again" }).click();

    await expect.element(page.getByRole("textbox")).toBeVisible();
    await expect.element(writingSkippedNotice()).not.toBeInTheDocument();
    expect(isChosenToday(CANT_WRITE_TODAY)).toBe(false);
  });

  it("asks for writing again the next day", async () => {
    localStorage.setItem(CANT_WRITE_TODAY, "2000-1-1");
    renderLessonPlayer({ lesson: buildLesson([explanationStep(), teachingStep("summary")]) });

    await expect.element(page.getByRole("textbox")).toBeVisible();
    await expect.element(writingSkippedNotice()).not.toBeInTheDocument();
  });

  it("names only an explanation as one in your own words, not a short exact answer", async () => {
    const lesson = buildLesson([
      contentStep("typedAnswer", {
        content: {
          ...playableStepContent.typedAnswer,
          acceptedAnswers: ["3 × 10⁸ m/s"],
          question:
            "Light travels about 300,000,000 meters per second. Write it in scientific notation.",
        },
      }),
      explanationStep(),
    ]);

    renderLessonPlayer({ lesson });

    await expect.element(page.getByRole("textbox", { name: /scientific notation/u })).toBeVisible();
    await expect.element(page.getByText("In your own words")).not.toBeInTheDocument();
    await page.getByRole("button", { name: "I don't know yet" }).click();
    await page.getByRole("button", { name: /^Continue/u }).click();

    await expect.element(page.getByRole("textbox", { name: /drawn as a cloud/u })).toBeVisible();
    await expect.element(page.getByText("In your own words")).toBeVisible();
  });

  it("keeps a number question, with no way to skip it, when the rest of the writing is left out", async () => {
    const question = "How many electrons does a hydrogen atom have?";

    const lesson = buildLesson([
      explanationStep(),
      contentStep("typedAnswer", {
        content: { ...playableStepContent.typedAnswer, acceptedAnswers: ["1"], question },
      }),
      teachingStep("summary"),
    ]);

    renderLessonPlayer({ lesson });
    await page.getByRole("button", { name: "Can't write now" }).click();

    // Typing a number is the calculation's answer, not writing: it stays, as a question to answer.
    await expect.element(page.getByRole("textbox", { name: question })).toBeVisible();
    await expect.element(page.getByRole("button", { name: /^Check/u })).toBeDisabled();
    await expect.element(page.getByText("In your own words")).not.toBeInTheDocument();

    await expect
      .element(page.getByRole("button", { name: "Can't write now" }))
      .not.toBeInTheDocument();

    await expect
      .element(page.getByRole("button", { name: "I don't know yet" }))
      .not.toBeInTheDocument();
  });
});

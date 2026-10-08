import { type PlayableSpokenAnswerStep } from "@zoonk/core/lesson-player/contract";
import { parseStepContent } from "@zoonk/core/library/steps/contract";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { languageStep } from "../_test-utils/language-steps";
import { spokenAnswerStep, teachingStep } from "../_test-utils/lesson-steps";
import {
  buildAdapters,
  buildLesson,
  renderLessonPlayer,
} from "../_test-utils/render-lesson-player";
import { type LessonPlayerAdapters } from "../lesson/lesson-player-types";

/**
 * "Say it out loud": the learner records the sentence and the host grades it. When they can't talk
 * now, the screen plays as listening for the rest of the visit; a recording with no words, or one
 * past today's help, says so and leaves typing as the way on.
 */

type GradeSpokenAnswer = NonNullable<LessonPlayerAdapters["gradeSpokenAnswer"]>;

/** The lesson's sentence to say, with its listening exercise for "I can't talk now". */
function spokenSentenceStep(): PlayableSpokenAnswerStep {
  return {
    ...spokenAnswerStep(),
    content: parseStepContent("spokenAnswer", {
      language: "en",
      prompt: "Pergunte quanto é o aluguel.",
      targetText: "How much is the rent?",
      translation: "Quanto é o aluguel?",
    }),
    listening: languageStep("listening").exercise,
  };
}

function openSpokenLesson({
  gradeSpokenAnswer,
  step = spokenAnswerStep(),
}: {
  gradeSpokenAnswer: GradeSpokenAnswer;
  step?: PlayableSpokenAnswerStep;
}) {
  const lesson = buildLesson([step, teachingStep("summary")]);
  return renderLessonPlayer({ adapters: buildAdapters(lesson, { gradeSpokenAnswer }), lesson });
}

/**
 * The test browser has no microphone, so a silent stream stands in for the one the learner
 * allowed, a new one per recording since each stops its own when it ends.
 */
function allowMicrophone() {
  const audio = new AudioContext();

  vi.spyOn(navigator.mediaDevices, "getUserMedia").mockImplementation(
    async () => audio.createMediaStreamDestination().stream,
  );
}

async function sayIt() {
  await page.getByRole("button", { name: "Start speaking" }).click();
  await page.getByRole("button", { name: "Stop and check" }).click();
}

describe("spoken answers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it("plays a spoken screen as listening when the learner can't talk now, for the visit", async () => {
    const gradeSpokenAnswer = vi.fn<GradeSpokenAnswer>();
    const step = spokenSentenceStep();
    const first = openSpokenLesson({ gradeSpokenAnswer, step });

    await expect.element(page.getByText("How much is the rent?")).toBeVisible();
    await page.getByRole("button", { name: "I can't talk now" }).click();

    const bank = page.getByRole("group", { name: "Word bank" });

    for (const word of [/^quanto$/iu, /^é$/iu, /^o$/iu, /^aluguel\?$/iu]) {
      // oxlint-disable-next-line no-await-in-loop -- The words go in one at a time, in order.
      await bank.getByRole("button", { name: word }).click();
    }

    await page.getByRole("button", { name: /^Check/u }).click();
    await expect.element(page.getByRole("status").filter({ hasText: "Correct!" })).toBeVisible();
    expect(gradeSpokenAnswer).not.toHaveBeenCalled();

    // The choice lasts for the visit: the screen opens as listening again, until they can talk.
    first.unmount();
    openSpokenLesson({ gradeSpokenAnswer, step });
    await expect.element(page.getByRole("group", { name: "Word bank" })).toBeVisible();
    await page.getByRole("button", { name: "I can talk now" }).click();
    await expect.element(page.getByRole("button", { name: "Start speaking" })).toBeVisible();
  });

  it("with no words in it says so and lets the learner try again or type", async () => {
    allowMicrophone();

    const gradeSpokenAnswer = vi.fn<GradeSpokenAnswer>(() =>
      Promise.resolve({ status: "noSpeech" as const }),
    );

    openSpokenLesson({ gradeSpokenAnswer });
    await sayIt();

    await expect.element(page.getByText("We couldn't hear any words. Try again.")).toBeVisible();

    await expect
      .element(page.getByText("We couldn't check your answer", { exact: false }))
      .not.toBeInTheDocument();

    await expect.element(page.getByRole("button", { name: "Type it instead" })).toBeVisible();

    // Trying again records and sends again.
    await sayIt();
    await expect.poll(() => gradeSpokenAnswer.mock.calls).toHaveLength(2);
  });

  it("says how a free learner keeps going once today's help is used up", async () => {
    allowMicrophone();

    const gradeSpokenAnswer = vi.fn<GradeSpokenAnswer>(() =>
      Promise.resolve({ status: "limitReached" as const, tier: "free" as const }),
    );

    openSpokenLesson({ gradeSpokenAnswer });
    await sayIt();

    await expect
      .element(
        page.getByText(
          "You've used today's help. It comes back tomorrow, or get Plus to keep going now.",
        ),
      )
      .toBeVisible();

    await expect.element(page.getByRole("link", { name: "See Plus" })).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Type it instead" })).toBeVisible();
  });

  // Pedro's microphone was blocked: the screen said "Type your answer instead" with nowhere to type.
  it("brings up the typing field when the microphone is blocked, and checks what's typed", async () => {
    vi.spyOn(navigator.mediaDevices, "getUserMedia").mockRejectedValue(
      new DOMException("Permission denied", "NotAllowedError"),
    );

    const gradeSpokenAnswer = vi.fn<GradeSpokenAnswer>();
    const step = spokenSentenceStep();
    const lesson = buildLesson([step, teachingStep("summary")]);
    const adapters = buildAdapters(lesson, { gradeSpokenAnswer });
    renderLessonPlayer({ adapters, lesson });

    await page.getByRole("button", { name: "Start speaking" }).click();

    await expect
      .element(page.getByText("The microphone is blocked. Type your answer instead."))
      .toBeVisible();

    await page
      .getByRole("textbox", { name: "Pergunte quanto é o aluguel." })
      .fill("How much is the rent?");

    await page.getByRole("button", { name: /^Check/u }).click();

    await expect
      .poll(() => adapters.checkStep)
      .toHaveBeenCalledWith(
        expect.objectContaining({
          answer: { kind: "spokenAnswer", text: "How much is the rent?" },
          stepId: step.id,
        }),
      );

    expect(gradeSpokenAnswer).not.toHaveBeenCalled();
  });
});

import { type PlayableSpokenAnswerStep } from "@zoonk/core/lesson-player/contract";
import { parseStepContent } from "@zoonk/core/library/steps/contract";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { buildAdapters, renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { type LessonPlayerAdapters, type SpokenAnswerOutcome } from "../lesson/lesson-player-types";
import { CHECK_BOUNDS } from "../lesson/use-step-grading";
import { buildLesson } from "../preview/preview-lesson";
import { languageStep, spokenAnswerStep, teachingStep } from "../preview/preview-steps";

type GradeSpokenAnswer = NonNullable<LessonPlayerAdapters["gradeSpokenAnswer"]>;

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

// The test browser has no microphone; each recording needs a fresh stream because stopping closes it.
function allowMicrophone() {
  const audio = new AudioContext();

  vi.spyOn(navigator.mediaDevices, "getUserMedia").mockImplementation(
    async () => audio.createMediaStreamDestination().stream,
  );
}

async function sayIt() {
  await page.getByRole("button", { name: "Record" }).click();
  await page.getByRole("button", { name: /^Stop/u }).click();
}

describe("spoken answers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("plays a spoken screen as listening when the learner can't talk now, for the day", async () => {
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

    first.unmount();
    const second = openSpokenLesson({ gradeSpokenAnswer, step });
    await expect.element(page.getByRole("group", { name: "Word bank" })).toBeVisible();

    second.unmount();
    const third = openSpokenLesson({ gradeSpokenAnswer });
    await expect.element(page.getByRole("textbox")).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Record" })).not.toBeInTheDocument();
    await page.getByRole("button", { name: "I can talk now" }).click();
    await expect.element(page.getByRole("button", { name: "Record" })).toBeVisible();

    third.unmount();
    openSpokenLesson({ gradeSpokenAnswer, step });
    await expect.element(page.getByRole("button", { name: "Record" })).toBeVisible();
  });

  it("saves the listening answer that replaced a slow spoken one only after that grade settles", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    allowMicrophone();

    const step = spokenSentenceStep();
    const lesson = buildLesson([step, teachingStep("summary")]);
    const late = Promise.withResolvers<SpokenAnswerOutcome>();
    const gradeSpokenAnswer = vi.fn<GradeSpokenAnswer>(() => late.promise);
    const adapters = buildAdapters(lesson, { gradeSpokenAnswer });
    renderLessonPlayer({ adapters, lesson });

    await sayIt();
    await vi.advanceTimersByTimeAsync(CHECK_BOUNDS.timeoutMs.spoken + 1000);
    await page.getByRole("button", { name: "I can't talk now" }).click();

    const bank = page.getByRole("group", { name: "Word bank" });

    for (const word of [/^quanto$/iu, /^é$/iu, /^o$/iu, /^aluguel\?$/iu]) {
      // oxlint-disable-next-line no-await-in-loop -- The words go in one at a time, in order.
      await bank.getByRole("button", { name: word }).click();
    }

    await page.getByRole("button", { name: /^Check/u }).click();
    await expect.element(page.getByRole("status").filter({ hasText: "Correct!" })).toBeVisible();

    await vi.advanceTimersByTimeAsync(1000);
    expect(adapters.checkStep).not.toHaveBeenCalled();

    late.resolve({ status: "failed" });
    await expect.poll(() => vi.mocked(adapters.checkStep).mock.calls.length).toBe(1);
    vi.useRealTimers();
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

    await expect.element(page.getByRole("button", { name: "I can't talk now" })).toBeVisible();

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
    await expect.element(page.getByRole("button", { name: "I can't talk now" })).toBeVisible();
  });

  it("brings up the typing field when the microphone is blocked, and checks what's typed", async () => {
    vi.spyOn(navigator.mediaDevices, "getUserMedia").mockRejectedValue(
      new DOMException("Permission denied", "NotAllowedError"),
    );

    const gradeSpokenAnswer = vi.fn<GradeSpokenAnswer>();
    const step = spokenSentenceStep();
    const lesson = buildLesson([step, teachingStep("summary")]);
    const adapters = buildAdapters(lesson, { gradeSpokenAnswer });
    renderLessonPlayer({ adapters, lesson });

    await page.getByRole("button", { name: "Record" }).click();

    await expect
      .element(page.getByText("The microphone is blocked. Type your answer instead."))
      .toBeVisible();

    const field = page.getByRole("textbox", { name: "Pergunte quanto é o aluguel." });
    await expect.element(field).toHaveFocus();
    await field.fill("How much is the rent?");

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

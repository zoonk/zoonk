import { serializeExerciseSteps } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { expectCount } from "../_test-utils/activity-player";
import { atViewport } from "../_test-utils/browser-viewport";
import { buildAdapters, renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { stubTutorApi } from "../_test-utils/tutor-api";
import { buildTutor } from "../_test-utils/tutor-config";
import {
  type LessonPlayerAdapters,
  type PlayableLanguageStep,
} from "../lesson/lesson-player-types";
import { CHECK_BOUNDS } from "../lesson/use-step-grading";
import { buildLesson, localAdapters } from "../preview/preview-lesson";
import { spokenAnswerStep } from "../preview/preview-steps";

const SENTENCE = "Quando pioveva l'autobus è arrivato";
const TRANSLATION = "Quando chovia, o ônibus chegou.";
const EXPLANATION = "Em italiano, o sujeito pode vir depois do verbo para dar ênfase.";

const RAINING = {
  audioUrl: null,
  distractors: ["piove", "treno"],
  explanation: EXPLANATION,
  id: crypto.randomUUID(),
  ordersPending: false,
  otherSentenceOrders: ["Quando pioveva è arrivato l'autobus"],
  otherTranslationOrders: ["O ônibus chegou quando chovia."],
  romanization: null,
  sentence: SENTENCE,
  translation: TRANSLATION,
  translationDistractors: ["trem"],
};

function sentenceStep(kind: "listening" | "reading", ordersPending = false): PlayableLanguageStep {
  const id = crypto.randomUUID();

  const sentence = {
    ...RAINING,
    ordersPending,
    otherSentenceOrders: ordersPending ? [] : RAINING.otherSentenceOrders,
    otherTranslationOrders: ordersPending ? [] : RAINING.otherTranslationOrders,
  };

  const [exercise] = serializeExerciseSteps({
    languages: { language: "pt", targetLanguage: "it" },
    resources: {
      distractorWords: [],
      lessonSentences: [sentence],
      lessonWords: [],
      sentenceWords: [],
    },
    steps: [{ content: {}, id, kind, position: 0, sentence, word: null }],
  });

  if (!exercise) {
    throw new Error(`The ${kind} exercise didn't serialize`);
  }

  return { exercise, id, kind, position: 0, skillId: null, wordHints: null };
}

function openLesson(kind: "listening" | "reading") {
  renderLessonPlayer({
    lesson: buildLesson([sentenceStep(kind)], { language: "pt", targetLanguage: "it" }),
  });
}

async function placeWords(words: string[]) {
  const bank = page.getByRole("group", { name: "Word bank" });

  for (const word of words) {
    // oxlint-disable-next-line no-await-in-loop -- The words go in one at a time, in order.
    await bank.getByRole("button", { exact: true, name: word }).click();
  }
}

const feedback = page.getByRole("region", { name: "Answer feedback" });
const check = page.getByRole("button", { name: /^Check/u });

describe("word orders", () => {
  it.each([
    {
      kind: "reading" as const,
      lessonVersion: SENTENCE,
      words: ["Quando", "pioveva", "è", "arrivato", "l'autobus"],
    },
    {
      kind: "listening" as const,
      lessonVersion: TRANSLATION,
      words: ["o", "ônibus", "chegou.", "Quando", "chovia,"],
    },
  ])(
    "accepts a $kind built in another right order, marking every word right and showing the lesson's",
    async ({ kind, lessonVersion, words }) => {
      openLesson(kind);

      await placeWords(words);
      await check.click();

      await expect.element(feedback.getByText("Correct!")).toBeVisible();

      await expectCount(
        page
          .getByRole("group", { name: "Your answer" })
          .getByRole("button", { name: /\. Correct\.$/u }),
        words.length,
      );

      await expect.element(feedback.getByText(`Also correct: ${lessonVersion}`)).toBeVisible();
      await expect.element(feedback.getByText(EXPLANATION)).toBeVisible();
    },
  );

  it("shows no other version for the lesson's own order", async () => {
    openLesson("reading");

    await placeWords(["Quando", "pioveva", "l'autobus", "è", "arrivato"]);
    await check.click();

    await expect.element(feedback.getByText("Correct!")).toBeVisible();
    await expect.element(feedback.getByText("Also correct:")).not.toBeInTheDocument();
  });
});

const SELF_CORRECT = "Not quite. Look again and fix it yourself, then check.";
const CHECK_FAILED = "We couldn't check your answer this time. Try again.";
const CHECK_SLOW = "Still checking. This is taking longer than usual.";
const WRONG_ORDER = ["pioveva", "Quando", "l'autobus", "è", "arrivato"];

describe("pending word orders", () => {
  it.each([
    {
      kind: "reading" as const,
      spoken: false,
      words: ["Quando", "pioveva", "è", "arrivato", "l'autobus"],
    },
    {
      kind: "listening" as const,
      spoken: false,
      words: ["o", "ônibus", "chegou.", "Quando", "chovia,"],
    },
    {
      kind: "listening" as const,
      spoken: true,
      words: ["o", "ônibus", "chegou.", "Quando", "chovia,"],
    },
  ])(
    "waits for the server to accept a missing $kind order (spoken fallback: $spoken)",
    async ({ kind, spoken, words }) => {
      const localStep = sentenceStep(kind, true);

      const step = spoken
        ? { ...spokenAnswerStep(), id: localStep.id, listening: localStep.exercise }
        : localStep;

      const lesson = buildLesson([step], { language: "pt", targetLanguage: "it" });
      const serverExercise = sentenceStep(kind);
      const serverStep = spoken ? { ...step, listening: serverExercise.exercise } : serverExercise;

      const server = localAdapters(
        buildLesson([{ ...serverStep, id: step.id }], { language: "pt", targetLanguage: "it" }),
      );

      const reply = Promise.withResolvers<Awaited<ReturnType<LessonPlayerAdapters["checkStep"]>>>();
      const checkStep = vi.fn<LessonPlayerAdapters["checkStep"]>(() => reply.promise);

      renderLessonPlayer({
        adapters: buildAdapters(lesson, { checkStep, gradeSpokenAnswer: vi.fn() }),
        lesson,
      });

      if (spoken) {
        await page.getByRole("button", { name: "I can't talk now" }).click();
      }

      await placeWords(words);
      await check.click();
      await expect.element(check).toHaveAttribute("aria-busy", "true");
      await expect.element(page.getByText(SELF_CORRECT)).not.toBeInTheDocument();
      await expect.element(feedback).not.toBeInTheDocument();
      const sent = checkStep.mock.calls[0]?.[0];
      expect(sent).toBeDefined();
      reply.resolve(await server.checkStep(sent!));

      await expect.element(feedback.getByText("Correct!")).toBeVisible();

      await expect
        .element(feedback.getByText(`Also correct: ${kind === "reading" ? SENTENCE : TRANSLATION}`))
        .toBeVisible();
    },
  );

  it.each(["reading", "listening"] as const)(
    "waits for a real %s miss before offering self-correction",
    async (kind) => {
      const step = sentenceStep(kind, true);
      const lesson = buildLesson([step], { language: "pt", targetLanguage: "it" });
      const server = localAdapters(lesson);
      const first = Promise.withResolvers<Awaited<ReturnType<LessonPlayerAdapters["checkStep"]>>>();

      const second =
        Promise.withResolvers<Awaited<ReturnType<LessonPlayerAdapters["checkStep"]>>>();

      const checkStep = vi
        .fn<LessonPlayerAdapters["checkStep"]>()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);

      renderLessonPlayer({ adapters: buildAdapters(lesson, { checkStep }), lesson });

      await placeWords(
        kind === "reading"
          ? ["pioveva", "Quando", "l'autobus", "è", "arrivato"]
          : ["ônibus", "o", "Quando", "chovia,", "chegou."],
      );

      await check.click();
      await expect.element(check).toHaveAttribute("aria-busy", "true");
      await expect.element(page.getByText(SELF_CORRECT)).not.toBeInTheDocument();
      first.resolve(await server.checkStep(checkStep.mock.calls[0]![0]));
      await expect.element(page.getByText(SELF_CORRECT)).toBeVisible();
      await expect.element(feedback).not.toBeInTheDocument();

      await check.click();
      await expect.element(check).toHaveAttribute("aria-busy", "true");
      second.resolve(await server.checkStep(checkStep.mock.calls[1]![0]));
      await expect.element(feedback.getByText("Not quite")).toBeVisible();

      await expect
        .element(feedback.getByText(`Answer: ${kind === "reading" ? SENTENCE : TRANSLATION}`))
        .toBeVisible();
    },
  );

  it("keeps the learner's picked words in the tutor quote after a server-checked fallback miss", async () => {
    await atViewport({ height: 812, width: 375 }, async () => {
      const localStep = sentenceStep("listening", true);
      const step = { ...spokenAnswerStep(), id: localStep.id, listening: localStep.exercise };
      const lesson = buildLesson([step], { language: "pt", targetLanguage: "it" });
      stubTutorApi({ lesson });

      renderLessonPlayer({
        adapters: buildAdapters(lesson, { gradeSpokenAnswer: vi.fn() }),
        lesson,
        tutor: buildTutor(),
      });

      await page.getByRole("button", { name: "I can't talk now" }).click();

      const words = ["ônibus", "o", "Quando", "chovia,", "chegou."];
      await placeWords(words);
      await check.click();
      await expect.element(feedback.getByText("Not quite")).toBeVisible();
      await expect.element(feedback.getByText(`Answer: ${TRANSLATION}`)).toBeVisible();
      await page.getByRole("button", { name: "Ask Pip" }).click();

      await expect
        .element(
          page.getByRole("dialog").getByText(`You picked ${words.join(" ")} on`, { exact: false }),
        )
        .toBeVisible();
    });
  });

  it.each([true, false])(
    "keeps a locally right answer instant (pending: %s)",
    async (ordersPending) => {
      const lesson = buildLesson([sentenceStep("reading", ordersPending)]);
      const reply = Promise.withResolvers<Awaited<ReturnType<LessonPlayerAdapters["checkStep"]>>>();

      renderLessonPlayer({
        adapters: buildAdapters(lesson, { checkStep: () => reply.promise }),
        lesson,
      });

      await placeWords(["Quando", "pioveva", "l'autobus", "è", "arrivato"]);
      await check.click();
      await expect.element(feedback.getByText("Correct!")).toBeVisible();
    },
  );

  it("keeps a non-pending local miss instant", async () => {
    const lesson = buildLesson([sentenceStep("reading")]);
    const reply = Promise.withResolvers<Awaited<ReturnType<LessonPlayerAdapters["checkStep"]>>>();

    renderLessonPlayer({
      adapters: buildAdapters(lesson, { checkStep: () => reply.promise }),
      lesson,
    });

    await placeWords(["pioveva", "Quando", "l'autobus", "è", "arrivato"]);
    await check.click();
    await expect.element(page.getByText(SELF_CORRECT)).toBeVisible();
  });

  it("keeps the words in place while the server checks them, and frees them if the check fails", async () => {
    const lesson = buildLesson([sentenceStep("reading", true)], {
      language: "pt",
      targetLanguage: "it",
    });

    const reply = Promise.withResolvers<Awaited<ReturnType<LessonPlayerAdapters["checkStep"]>>>();
    const checkStep = vi.fn<LessonPlayerAdapters["checkStep"]>(() => reply.promise);
    renderLessonPlayer({ adapters: buildAdapters(lesson, { checkStep }), lesson });

    await placeWords(WRONG_ORDER);
    await check.click();
    await expect.element(check).toHaveAttribute("aria-busy", "true");

    const answer = page.getByRole("group", { name: "Your answer" });
    const firstPlaced = answer.getByRole("button", { name: "Position 1: pioveva. Tap to remove." });
    await expect.element(firstPlaced).toBeDisabled();

    await expect
      .element(
        page
          .getByRole("group", { name: "Word bank" })
          .getByRole("button", { exact: true, name: "piove" }),
      )
      .toBeDisabled();

    reply.resolve({ status: "failed" });
    await expect.element(page.getByText(CHECK_FAILED)).toBeVisible();
    await firstPlaced.click();
    await expect.element(answer.getByRole("button", { name: /pioveva/u })).not.toBeInTheDocument();
  });

  describe("a slow or failed check", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("uses a new attempt for rearranged words after a failed check and reuses it for unchanged words", async () => {
      const lesson = buildLesson([sentenceStep("reading", true)], {
        language: "pt",
        targetLanguage: "it",
      });

      const checkStep = vi
        .fn<LessonPlayerAdapters["checkStep"]>()
        .mockRejectedValue(new Error("offline"));

      renderLessonPlayer({ adapters: buildAdapters(lesson, { checkStep }), lesson });

      await placeWords(WRONG_ORDER);
      await check.click();
      await expect.element(page.getByText(CHECK_FAILED)).toBeVisible();
      expect(checkStep).toHaveBeenCalledOnce();
      const first = checkStep.mock.calls[0]![0];
      expect(first.attemptId).toStrictEqual(expect.any(String));

      await page
        .getByRole("group", { name: "Your answer" })
        .getByRole("button", { name: "Position 1: pioveva. Tap to remove." })
        .click();

      await placeWords(["pioveva"]);
      await check.click();
      await expect.element(page.getByText(CHECK_FAILED)).toBeVisible();
      expect(checkStep).toHaveBeenCalledTimes(2);
      const rearranged = checkStep.mock.calls[1]![0];
      expect(rearranged.answer).not.toStrictEqual(first.answer);
      expect(rearranged.attemptId).toStrictEqual(expect.any(String));
      expect(rearranged.attemptId).not.toBe(first.attemptId);

      await check.click();
      await expect.element(page.getByText(CHECK_FAILED)).toBeVisible();
      expect(checkStep).toHaveBeenCalledTimes(3);
      const retried = checkStep.mock.calls[2]![0];
      expect(retried.answer).toStrictEqual(rearranged.answer);
      expect(retried.attemptId).toBe(rearranged.attemptId);
    });

    it("says a word bank's check failed and lets the learner check again", async () => {
      const lesson = buildLesson([sentenceStep("reading", true)], {
        language: "pt",
        targetLanguage: "it",
      });

      const server = localAdapters(lesson);

      const checkStep = vi
        .fn<LessonPlayerAdapters["checkStep"]>()
        .mockRejectedValueOnce(new Error("offline"))
        .mockImplementationOnce((input) => server.checkStep(input));

      renderLessonPlayer({ adapters: buildAdapters(lesson, { checkStep }), lesson });

      await placeWords(WRONG_ORDER);
      await check.click();

      await expect.element(page.getByText(CHECK_FAILED)).toBeVisible();
      await expect.element(check).toBeEnabled();

      await check.click();
      await expect.element(page.getByText(SELF_CORRECT)).toBeVisible();
      await expect.element(page.getByText(CHECK_FAILED)).not.toBeInTheDocument();
      expect(checkStep).toHaveBeenCalledTimes(2);
    });

    it("says a word bank's check is taking longer than usual", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      const lesson = buildLesson([sentenceStep("reading", true)], {
        language: "pt",
        targetLanguage: "it",
      });

      const server = localAdapters(lesson);
      const reply = Promise.withResolvers<Awaited<ReturnType<LessonPlayerAdapters["checkStep"]>>>();
      const checkStep = vi.fn<LessonPlayerAdapters["checkStep"]>(() => reply.promise);

      renderLessonPlayer({ adapters: buildAdapters(lesson, { checkStep }), lesson });

      await placeWords(WRONG_ORDER);
      await check.click();
      await expect.element(check).toHaveAttribute("aria-busy", "true");
      await expect.element(page.getByText(CHECK_SLOW)).not.toBeInTheDocument();

      await vi.advanceTimersByTimeAsync(CHECK_BOUNDS.slowMs + 1000);
      await expect.element(page.getByText(CHECK_SLOW)).toBeVisible();

      reply.resolve(await server.checkStep(checkStep.mock.calls[0]![0]));
      await expect.element(page.getByText(SELF_CORRECT)).toBeVisible();
      await expect.element(page.getByText(CHECK_SLOW)).not.toBeInTheDocument();
    });
  });
});

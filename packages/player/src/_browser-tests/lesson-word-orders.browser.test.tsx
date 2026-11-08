import { serializeExerciseSteps } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { expectCount } from "../_test-utils/activity-player";
import { buildAdapters, renderLessonPlayer } from "../_test-utils/render-lesson-player";
import {
  type LessonPlayerAdapters,
  type PlayableLanguageStep,
} from "../lesson/lesson-player-types";
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

      await placeWords(words.slice(0, -1));
      await expect.element(check).toBeDisabled();
      await placeWords(words.slice(-1));
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
});

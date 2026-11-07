import { serializeExerciseSteps } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { expectCount } from "../_test-utils/activity-player";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { type PlayableLanguageStep } from "../lesson/lesson-player-types";
import { buildLesson } from "../preview/preview-lesson";

const SENTENCE = "Quando pioveva l'autobus è arrivato";
const TRANSLATION = "Quando chovia, o ônibus chegou.";
const EXPLANATION = "Em italiano, o sujeito pode vir depois do verbo para dar ênfase.";

const RAINING = {
  audioUrl: null,
  distractors: ["piove", "treno"],
  explanation: EXPLANATION,
  id: crypto.randomUUID(),
  otherSentenceOrders: ["Quando pioveva è arrivato l'autobus"],
  otherTranslationOrders: ["O ônibus chegou quando chovia."],
  romanization: null,
  sentence: SENTENCE,
  translation: TRANSLATION,
  translationDistractors: ["trem"],
};

function sentenceStep(kind: "listening" | "reading"): PlayableLanguageStep {
  const id = crypto.randomUUID();

  const [exercise] = serializeExerciseSteps({
    languages: { language: "pt", targetLanguage: "it" },
    resources: {
      distractorWords: [],
      lessonSentences: [RAINING],
      lessonWords: [],
      sentenceWords: [],
    },
    steps: [{ content: {}, id, kind, position: 0, sentence: RAINING, word: null }],
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

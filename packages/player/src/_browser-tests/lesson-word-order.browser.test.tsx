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

async function buildAnswer(words: string[]) {
  const bank = page.getByRole("group", { name: "Word bank" });

  for (const word of words) {
    // oxlint-disable-next-line no-await-in-loop -- The words go in one at a time, in order.
    await bank.getByRole("button", { exact: true, name: word }).click();
  }

  await page.getByRole("button", { name: /^Check/u }).click();
}

describe("word order", () => {
  it("accepts a sentence built in another right order, marking every word right and showing the lesson's", async () => {
    const lesson = buildLesson([sentenceStep("reading"), sentenceStep("listening")], {
      language: "pt",
      targetLanguage: "it",
    });

    renderLessonPlayer({ lesson });

    await buildAnswer(["Quando", "pioveva", "è", "arrivato", "l'autobus"]);

    const feedback = page.getByRole("region", { name: "Answer feedback" });
    await expect.element(feedback.getByText("Correct!")).toBeVisible();

    const answer = page.getByRole("group", { name: "Your answer" });
    await expectCount(answer.getByRole("button", { name: /\. Correct\.$/u }), 5);

    await expect.element(feedback.getByText(`Also correct: ${SENTENCE}`)).toBeVisible();
    await expect.element(feedback.getByText(EXPLANATION)).toBeVisible();
    await page.getByRole("button", { name: /^Continue/u }).click();

    await buildAnswer(["Quando", "chovia,", "o", "ônibus", "chegou."]);
    await expect.element(feedback.getByText("Correct!")).toBeVisible();
    await expect.element(feedback.getByText("Also correct:")).not.toBeInTheDocument();
  });
});

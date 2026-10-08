import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { languageStep } from "../_test-utils/language-steps";
import { teachingStep } from "../_test-utils/lesson-steps";
import {
  acceptedAnswerCheck,
  buildAdapters,
  buildLesson,
  renderLessonPlayer,
} from "../_test-utils/render-lesson-player";

/**
 * A language lesson's own screens: sentences built from a word bank (reading builds the sentence,
 * listening its translation), a blank that gets one chance to fix a wrong word, a sentence to
 * write, and the end, which counts each screen by its first answer. A new script's lesson shows
 * each letter with its reading and sound, then matches them.
 */

const SENTENCE = "How much is the rent?";
const RIGHT_TYPED = "It shows where the electron is likely to be";

/** Word-bank words keep their punctuation ("rent?"), which a name pattern must match as text. */
function exactWord(word: string): RegExp {
  return new RegExp(`^${word.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`)}$`, "iu");
}

/** A verdict as the player announces it. */
function verdict(text: string) {
  return page.getByRole("status").filter({ hasText: text });
}

async function pickWords(words: string[]) {
  const bank = page.getByRole("group", { name: "Word bank" });

  for (const word of words) {
    // oxlint-disable-next-line no-await-in-loop -- The words go in one at a time, in order.
    await bank.getByRole("button", { name: exactWord(word) }).click();
  }
}

async function checkRightAndContinue() {
  await page.getByRole("button", { name: /^Check/u }).click();
  await expect.element(verdict("Correct!")).toBeVisible();
  await page.getByRole("button", { name: /^Continue/u }).click();
}

/** A letter's card as an alphabet lesson stores it; only some letters have a recorded clip. */
function letter({
  audioUrl,
  reading,
  symbol,
}: {
  audioUrl: string | null;
  reading: string;
  symbol: string;
}) {
  return languageStep("alphabet", {
    audioText: symbol,
    audioUrl,
    forms: [],
    pronunciation: `Como o ${reading} de casa.`,
    readingAid: reading,
    symbol,
  });
}

describe("language lesson screens", () => {
  it("builds sentences from the word bank, fixes a blank once, writes a sentence and counts first answers", async () => {
    const writing = teachingStep("typedAnswer");

    const lesson = buildLesson(
      [
        languageStep("reading"),
        languageStep("listening"),
        languageStep("fillBlank"),
        writing,
        teachingStep("summary"),
      ],
      { language: "pt", targetLanguage: "en" },
    );

    const graded = buildAdapters(lesson).checkStep;
    const accepted = acceptedAnswerCheck(writing);

    const { completeLesson } = buildAdapters(lesson);

    renderLessonPlayer({
      adapters: buildAdapters(lesson, {
        // Written answers are graded only on the server; the rest the way it grades them.
        checkStep: (input) =>
          input.answer.kind === "typedAnswer" ? accepted(input) : graded(input),
        // The server counts each screen's first answer, as the screens did.
        completeLesson: async (input) => {
          const outcome = await completeLesson(input);

          return outcome.status === "completed"
            ? {
                ...outcome,
                completion: { ...outcome.completion, correctCount: 3, incorrectCount: 1 },
              }
            : outcome;
        },
      }),
      lesson,
    });

    await expect.element(page.getByText("Translate this sentence:")).toBeVisible();
    await pickWords(["How", "much", "is", "the", "rent?"]);
    await checkRightAndContinue();

    await expect.element(page.getByText(SENTENCE, { exact: true })).toBeVisible();
    await pickWords(["quanto", "é", "o", "aluguel?"]);
    await checkRightAndContinue();

    // A wrong word gets one chance to fix it before the answer is shown.
    await expect.element(page.getByText("The electron is drawn as a")).toBeVisible();
    await pickWords(["orbit"]);
    await page.getByRole("button", { name: /^Check/u }).click();

    await expect
      .element(verdict("Not quite. Look again and fix it yourself, then check."))
      .toBeVisible();

    await page.getByRole("button", { name: "Blank 1: orbit. Tap to remove." }).click();
    await pickWords(["cloud"]);
    await page.getByRole("button", { name: /^Check/u }).click();

    const feedback = page.getByRole("region", { name: "Answer feedback" });
    await expect.element(feedback.getByText("Correct!")).toBeVisible();

    await expect
      .element(feedback.getByText("The electron is described by a cloud of chances."))
      .toBeVisible();

    await page.getByRole("button", { name: /^Continue/u }).click();

    await page
      .getByRole("textbox", { name: "In your own words: why is the electron drawn as a cloud?" })
      .fill(RIGHT_TYPED);

    await checkRightAndContinue();

    await expect.element(page.getByRole("heading", { name: "Summary" })).toBeVisible();
    await page.getByRole("button", { name: /^Continue/u }).click();

    await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();

    // The blank's first answer was wrong, so it counts as a miss even though it was fixed.
    await expect.element(page.getByText("3 of 4 right")).toBeVisible();
    await expect.element(page.getByText("+10 Brain Power")).toBeVisible();
  });

  it("shows each letter with its reading and, when recorded, its sound, then matches them", async () => {
    renderLessonPlayer({
      lesson: buildLesson(
        [
          letter({ audioUrl: "https://audio.zoonk.test/ja-a.mp3", reading: "a", symbol: "あ" }),
          letter({ audioUrl: null, reading: "ka", symbol: "か" }),
          languageStep("matchColumns", {
            pairs: [
              { left: "あ", right: "a" },
              { left: "か", right: "ka" },
            ],
          }),
          teachingStep("summary"),
        ],
        { language: "pt", targetLanguage: "ja" },
      ),
    });

    const next = page.getByRole("button", { name: /^Next/u });
    const firstCard = page.getByRole("region", { name: "Alphabet: あ" });

    await expect.element(firstCard.getByText("a", { exact: true })).toBeVisible();
    await expect.element(firstCard.getByText("Como o a de casa.")).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Play pronunciation" })).toBeVisible();
    await next.click();

    await expect.element(page.getByRole("region", { name: "Alphabet: か" })).toBeVisible();

    await expect
      .element(page.getByRole("button", { name: "Play pronunciation" }))
      .not.toBeInTheDocument();

    await next.click();

    await expect.element(page.getByText("Match the pairs.")).toBeVisible();

    for (const label of ["あ", "a", "か", "ka"]) {
      // oxlint-disable-next-line no-await-in-loop -- A pair is matched by tapping its sides in turn.
      await page.getByRole("button", { exact: true, name: label }).click();
    }

    // Matching gives feedback pair by pair, so Check moves straight on.
    await page.getByRole("button", { name: /^Check/u }).click();
    await expect.element(page.getByRole("heading", { name: "Summary" })).toBeVisible();
  });
});

import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { expectCount } from "../_test-utils/activity-player";
import {
  acceptedAnswerCheck,
  buildAdapters,
  renderLessonPlayer,
} from "../_test-utils/render-lesson-player";
import { buildLesson } from "../preview/preview-lesson";
import { languageStep, teachingStep } from "../preview/preview-steps";

/**
 * A language lesson's own screens: sentences built from a word bank (reading builds the sentence,
 * listening its translation) that takes no more words than the answer, a blank that gets one
 * chance to fix a wrong word, and a sentence to write. In a script the learner can't read yet, the
 * words and sentences show their reading. A new script's lesson shows each letter with its reading
 * and sound, then matches them.
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
  it("can't write now skips every remaining writing screen and finishes without checking them", async () => {
    const first = teachingStep("typedAnswer");
    const second = teachingStep("typedAnswer");

    const lesson = buildLesson(
      [first, teachingStep("explanation"), second, teachingStep("summary")],
      { language: "pt", targetLanguage: "en" },
    );

    const adapters = buildAdapters(lesson);
    const { unmount } = renderLessonPlayer({ adapters, lesson });

    await page.getByRole("button", { name: "Can't write now" }).click();
    await expect.element(page.getByRole("textbox")).not.toBeInTheDocument();

    // The screen after it says the whole lesson is free of writing, and the keyboard stays in the
    // lesson instead of falling back to the page with the button that left.
    const notice = page.getByRole("status").filter({ hasText: "No more writing in this lesson." });
    await expect.element(notice).toBeVisible();
    await expect.element(page.getByRole("button", { name: /^Next/u })).toHaveFocus();

    await page.getByRole("button", { name: /^Next/u }).click();
    await expect.element(page.getByRole("heading", { name: "Summary" })).toBeVisible();
    await expect.element(notice).not.toBeInTheDocument();
    await page.getByRole("button", { name: /^Continue/u }).click();
    await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();
    expect(adapters.checkStep).not.toHaveBeenCalled();

    expect(adapters.completeLesson).toHaveBeenCalledWith({
      runId: expect.any(String),
      skippedWritingStepIds: [first.id, second.id],
    });

    // A new sitting asks for writing again; temporary skips never become a preference.
    unmount();
    renderLessonPlayer({ lesson });
    await expect.element(page.getByRole("button", { name: "Can't write now" })).toBeVisible();
  });

  it("builds sentences from the word bank, fixes a blank once and writes a sentence", async () => {
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

    renderLessonPlayer({
      adapters: buildAdapters(lesson, {
        // Written answers are graded only on the server; the rest the way it grades them.
        checkStep: (input) =>
          input.answer.kind === "typedAnswer" ? accepted(input) : graded(input),
      }),
      lesson,
    });

    await expect.element(page.getByText("Translate", { exact: true })).toBeVisible();
    await pickWords(["How", "much", "is", "the", "rent?"]);

    // The sentence is whole, so a word tapped after it stays in the bank.
    await pickWords(["many"]);
    await expectCount(page.getByRole("group", { name: "Your answer" }).getByRole("button"), 5);
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
  });

  it("shows the reading of a blank's sentence and of each word in the bank", async () => {
    renderLessonPlayer({
      lesson: buildLesson(
        [
          languageStep("fillBlank", {
            answers: ["を"],
            distractors: ["は", "に"],
            feedback: "を marks what you ask for.",
            romanizations: Object.fromEntries([
              ["お金をお願いします。", "okane o onegai shimasu."],
              ["を", "o"],
              ["は", "wa"],
              ["に", "ni"],
            ]),
            template: "お金[BLANK]お願いします。",
          }),
        ],
        { language: "pt", targetLanguage: "ja" },
      ),
    });

    // The sentence's reading leaves its blank empty, so it doesn't give the answer away.
    await expect.element(page.getByText("okane ____ onegai shimasu.")).toBeVisible();

    const bank = page.getByRole("group", { name: "Word bank" });

    for (const [word, reading] of [
      ["を", "o"],
      ["は", "wa"],
      ["に", "ni"],
    ] as const) {
      // oxlint-disable-next-line no-await-in-loop -- Each tile is checked in turn.
      await expect
        .element(bank.getByRole("button", { exact: true, name: word }))
        .toHaveAccessibleDescription(reading);
    }
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

  it("marks a language question's right answer and a wrong pick, like every question", async () => {
    renderLessonPlayer({
      lesson: buildLesson(
        [languageStep("multipleChoice"), languageStep("translation"), teachingStep("summary")],
        { language: "pt", targetLanguage: "en" },
      ),
    });

    await page.getByRole("radio", { name: "An orbit" }).click();
    await page.getByRole("button", { name: /^Check/u }).click();
    await expect.element(verdict("Not quite")).toBeVisible();

    // The header's segment for a language question turns red, like any question's.
    expect(document.querySelector<HTMLElement>("[data-segment]")?.dataset.segment).toBe("wrong");

    await expect
      .element(page.getByRole("radio", { name: "An orbit" }))
      .toMatchTextContent(/Your answer/u);

    await expect
      .element(page.getByRole("radio", { name: "A cloud" }))
      .toMatchTextContent(/Correct/u);

    await page.getByRole("button", { name: /^Continue/u }).click();

    // A right pick stays on its own, marked; the other words step aside for the result.
    await page.getByRole("radio", { name: /^rent/iu }).click();
    await page.getByRole("button", { name: /^Check/u }).click();
    await expect.element(verdict("Correct!")).toBeVisible();
    await expectCount(page.getByRole("radio"), 1);

    // The right pick is the learner's own: "Your answer", in green, under "Correct!".
    await expect
      .element(page.getByRole("radio", { name: /^rent/iu }))
      .toMatchTextContent(/Your answer/u);
  });
});

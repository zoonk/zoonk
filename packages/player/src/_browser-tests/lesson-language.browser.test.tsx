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

const SENTENCE = "How much is the rent?";
const RIGHT_TYPED = "It shows where the electron is likely to be";

function exactWord(word: string): RegExp {
  return new RegExp(`^${word.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`)}$`, "iu");
}

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
        checkStep: (input) =>
          input.answer.kind === "typedAnswer" ? accepted(input) : graded(input),
      }),
      lesson,
    });

    await expect.element(page.getByText("Translate", { exact: true })).toBeVisible();
    await pickWords(["How", "much", "is", "the", "rent?"]);

    await pickWords(["many"]);
    await expectCount(page.getByRole("group", { name: "Your answer" }).getByRole("button"), 5);
    await checkRightAndContinue();

    await expect.element(page.getByText(SENTENCE, { exact: true })).toBeVisible();
    await pickWords(["quanto", "é", "o", "aluguel?"]);
    await checkRightAndContinue();

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

    expect(document.querySelector<HTMLElement>("[data-segment]")?.dataset.segment).toBe("wrong");

    await expect
      .element(page.getByRole("radio", { name: "An orbit" }))
      .toMatchTextContent(/Your answer/u);

    await expect
      .element(page.getByRole("radio", { name: "A cloud" }))
      .toMatchTextContent(/Correct/u);

    await page.getByRole("button", { name: /^Continue/u }).click();

    await page.getByRole("radio", { name: /^rent/iu }).click();
    await page.getByRole("button", { name: /^Check/u }).click();
    await expect.element(verdict("Correct!")).toBeVisible();
    await expectCount(page.getByRole("radio"), 1);

    await expect
      .element(page.getByRole("radio", { name: /^rent/iu }))
      .toMatchTextContent(/Your answer/u);
  });
});

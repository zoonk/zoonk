import { type WordBankOption } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { expectCount, expectSideBySide } from "../_test-utils/activity-player";
import {
  acceptedAnswerCheck,
  buildAdapters,
  renderLessonPlayer,
} from "../_test-utils/render-lesson-player";
import { wavClip } from "../_test-utils/speech-clips";
import { type PlayableLanguageStep } from "../lesson/lesson-player-types";
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

function wordAudioUrl(word: string): string {
  return `https://audio.zoonk.test/${encodeURIComponent(word)}.mp3`;
}

function voiced(option: WordBankOption): WordBankOption {
  return { ...option, audioUrl: wordAudioUrl(option.word) };
}

function withWordAudio(step: PlayableLanguageStep): PlayableLanguageStep {
  return {
    ...step,
    exercise: {
      ...step.exercise,
      fillBlankOptions: step.exercise.fillBlankOptions.map(voiced),
      wordBankOptions: step.exercise.wordBankOptions.map(voiced),
    },
  };
}

function pronunciationButtons(state: "Pause" | "Play") {
  return page.getByRole("button", { name: `${state} pronunciation` });
}

function recordPlays(): string[] {
  const played: string[] = [];

  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function play(
    this: HTMLMediaElement,
  ) {
    played.push(this.src);
    return Promise.resolve();
  });

  return played;
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
  afterEach(() => {
    vi.restoreAllMocks();
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

  it("says each word in the bank as it goes into the answer", async () => {
    const played = recordPlays();

    renderLessonPlayer({
      lesson: buildLesson(
        [
          withWordAudio(languageStep("reading")),
          withWordAudio(languageStep("fillBlank")),
          teachingStep("summary"),
        ],
        { language: "pt", targetLanguage: "en" },
      ),
    });

    await pickWords(["How", "much"]);
    expect(played).toStrictEqual([wordAudioUrl("How"), wordAudioUrl("much")]);

    await pickWords(["is", "the", "rent?"]);
    await checkRightAndContinue();

    await expect.element(page.getByText("The electron is drawn as a")).toBeVisible();
    await pickWords(["cloud"]);
    expect(played.at(-1)).toBe(wordAudioUrl("cloud"));
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
    await expectCount(firstCard.getByRole("button", { name: "Play pronunciation" }), 1);
    await expectCount(pronunciationButtons("Play"), 2);
    await next.click();

    await expect.element(page.getByRole("region", { name: "Alphabet: か" })).toBeVisible();
    await expect.element(pronunciationButtons("Play")).not.toBeInTheDocument();

    await next.click();

    await expect.element(page.getByText("Match the pairs.")).toBeVisible();

    for (const label of ["あ", "a", "か", "ka"]) {
      // oxlint-disable-next-line no-await-in-loop -- A pair is matched by tapping its sides in turn.
      await page.getByRole("button", { exact: true, name: label }).click();
    }

    await page.getByRole("button", { name: /^Check/u }).click();
    await expect.element(page.getByRole("heading", { name: "Summary" })).toBeVisible();
  });

  it("puts each word beside its match once every pair is matched", async () => {
    const pairs = [
      { left: "Electron", right: "Negative charge" },
      { left: "Proton", right: "Positive charge" },
      { left: "Neutron", right: "No charge" },
    ];

    const step = languageStep("matchColumns", { pairs });
    const shuffled = ["Positive charge", "No charge", "Negative charge"];

    renderLessonPlayer({
      lesson: buildLesson([
        { ...step, exercise: { ...step.exercise, matchColumnsRightItems: shuffled } },
      ]),
    });

    for (const { left, right } of pairs) {
      // oxlint-disable-next-line no-await-in-loop -- A pair is matched by tapping its sides in turn.
      await page.getByRole("button", { exact: true, name: left }).click();
      // oxlint-disable-next-line no-await-in-loop -- A pair is matched by tapping its sides in turn.
      await page.getByRole("button", { exact: true, name: right }).click();
    }

    for (const { left, right } of pairs) {
      // oxlint-disable-next-line no-await-in-loop -- Each pair is checked once the board settles.
      await expectSideBySide(
        page.getByRole("button", { exact: true, name: left }),
        page.getByRole("button", { exact: true, name: right }),
      );
    }
  });

  it("says a letter as it shows, with the same state on its own control and the bar's", async () => {
    const sound = URL.createObjectURL(wavClip(1));
    const played = recordPlays();

    renderLessonPlayer({
      lesson: buildLesson([letter({ audioUrl: sound, reading: "a", symbol: "あ" })], {
        language: "pt",
        targetLanguage: "ja",
      }),
    });

    const card = page.getByRole("region", { name: "Alphabet: あ" });

    await expectCount(pronunciationButtons("Pause"), 2);
    expect(new Set(played)).toStrictEqual(new Set([sound]));

    await card.getByRole("button", { name: "Pause pronunciation" }).click();
    await expectCount(pronunciationButtons("Play"), 2);
    const playedBeforeTap = played.length;

    await card.getByRole("button", { name: "Play pronunciation" }).click();
    await expectCount(pronunciationButtons("Pause"), 2);
    expect(played).toHaveLength(playedBeforeTap + 1);
  });

  it("leaves both controls at rest when the browser blocks the sound, until the learner taps one", async () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockRejectedValue(new DOMException("No gesture yet", "NotAllowedError"));

    renderLessonPlayer({
      lesson: buildLesson(
        [letter({ audioUrl: URL.createObjectURL(wavClip(1)), reading: "a", symbol: "あ" })],
        { language: "pt", targetLanguage: "ja" },
      ),
    });

    await expect.poll(() => play.mock.calls.length).toBeGreaterThan(0);
    await expectCount(pronunciationButtons("Play"), 2);

    play.mockResolvedValue();
    await pronunciationButtons("Play").last().click();
    await expectCount(pronunciationButtons("Pause"), 2);
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

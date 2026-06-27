import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { runInMobilePlayerViewport } from "../_test-utils/browser-viewport";
import {
  buildSerializedLesson,
  buildSerializedSentence,
  buildSerializedStep,
  buildWordBankOption,
} from "../_test-utils/player-test-data";
import { buildAuthenticatedViewer } from "../_test-utils/player-test-viewer";
import { renderPlayer } from "../_test-utils/render-player";

describe("player browser integration: word bank steps", () => {
  it("fills blanks, checks the answer, and reaches completion", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        steps: [
          buildSerializedStep({
            content: {
              answers: ["cat", "mat"],
              distractors: ["dog"],
              feedback: "Nice work",
              template: "The [BLANK] sat on the [BLANK]",
            },
            fillBlankOptions: [
              buildWordBankOption({ word: "cat" }),
              buildWordBankOption({ word: "mat" }),
              buildWordBankOption({ word: "dog" }),
            ],
            kind: "fillBlank",
          }),
        ],
      }),
      viewer: buildAuthenticatedViewer(),
    });

    const wordBank = page.getByRole("group", { name: /word bank/iu });

    await wordBank.getByRole("button", { name: "cat" }).click();
    await wordBank.getByRole("button", { name: "mat" }).click();
    await expect.element(page.getByRole("button", { name: /check/iu })).toBeEnabled();

    await page.getByRole("button", { name: /check/iu }).click();
    await expect.element(page.getByText(/correct!/iu)).toBeInTheDocument();

    await page.getByRole("button", { name: /continue/iu }).click();
    await expect.element(page.getByText("100%")).toBeInTheDocument();
  });

  it("builds a reading answer from the word bank and shows inline feedback", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        kind: "reading",
        steps: [
          buildSerializedStep({
            content: {},
            kind: "reading",
            sentence: buildSerializedSentence({
              sentence: "Hola mundo",
              translation: "Hello world",
            }),
            wordBankOptions: [
              buildWordBankOption({ pronunciation: "OH-lah", word: "Hola" }),
              buildWordBankOption({ word: "mundo" }),
              buildWordBankOption({ word: "gato" }),
            ],
          }),
        ],
      }),
      viewer: buildAuthenticatedViewer(),
    });

    const wordBank = page.getByRole("group", { name: /word bank/iu });
    const holaOption = wordBank.getByRole("button", { exact: true, name: "Hola" });

    await expect.element(holaOption.getByText("OH-lah")).toBeInTheDocument();

    await holaOption.click();
    await wordBank.getByRole("button", { exact: true, name: "mundo" }).click();
    await page.getByRole("button", { name: /check/iu }).click();

    await expect.element(page.getByRole("button", { name: /continue/iu })).toBeInTheDocument();
    await page.getByRole("button", { name: /continue/iu }).click();
    await expect.element(page.getByText("100%")).toBeInTheDocument();
  });

  it("toggles reading word-bank options from number shortcuts", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        kind: "reading",
        steps: [
          buildSerializedStep({
            content: {},
            kind: "reading",
            sentence: buildSerializedSentence({
              sentence: "Hola mundo",
              translation: "Hello world",
            }),
            wordBankOptions: [
              buildWordBankOption({ word: "Hola" }),
              buildWordBankOption({ word: "mundo" }),
              buildWordBankOption({ word: "gato" }),
            ],
          }),
        ],
      }),
      viewer: buildAuthenticatedViewer(),
    });

    const wordBank = page.getByRole("group", { name: /word bank/iu });
    const mundoOption = wordBank.getByRole("button", { exact: true, name: "mundo" });

    await expect.element(mundoOption.getByText(/^2$/u)).toBeInTheDocument();
    await expect.element(mundoOption).toHaveAttribute("aria-keyshortcuts", "2");

    fireEvent.keyDown(globalThis.window, { key: "2" });

    const answerTile = page
      .getByRole("group", { name: /your answer/iu })
      .getByRole("button", { name: /mundo/iu });

    await expect.element(answerTile).toBeInTheDocument();

    await expect.element(answerTile.getByText(/^2$/u)).toBeInTheDocument();
    await expect.element(answerTile).toHaveAttribute("aria-keyshortcuts", "2");
    await expect.element(mundoOption).toHaveAttribute("aria-pressed", "true");

    fireEvent.keyDown(globalThis.window, { key: "2" });

    await expect
      .element(
        page.getByRole("group", { name: /your answer/iu }).getByRole("button", { name: /mundo/iu }),
      )
      .not.toBeInTheDocument();

    await expect.element(mundoOption).toHaveAttribute("aria-pressed", "false");

    fireEvent.keyDown(globalThis.window, { key: "1" });
    fireEvent.keyDown(globalThis.window, { key: "2" });

    await expect.element(page.getByRole("button", { name: /check/iu })).toBeEnabled();
  });

  it("toggles fill-blank word-bank options from number shortcuts", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        steps: [
          buildSerializedStep({
            content: {
              answers: ["cat"],
              distractors: ["dog"],
              feedback: "Nice work",
              template: "The [BLANK] sleeps",
            },
            fillBlankOptions: [
              buildWordBankOption({ word: "dog" }),
              buildWordBankOption({ word: "cat" }),
            ],
            kind: "fillBlank",
          }),
        ],
      }),
      viewer: buildAuthenticatedViewer(),
    });

    const wordBank = page.getByRole("group", { name: /word bank/iu });
    const catOption = wordBank.getByRole("button", { exact: true, name: "cat" });

    await expect.element(catOption.getByText(/^2$/u)).toBeInTheDocument();
    await expect.element(catOption).toHaveAttribute("aria-keyshortcuts", "2");

    fireEvent.keyDown(globalThis.window, { key: "2" });

    await expect.element(page.getByRole("button", { name: /tap to remove/iu })).toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: /check/iu })).toBeEnabled();

    fireEvent.keyDown(globalThis.window, { key: "2" });

    await expect
      .element(page.getByRole("button", { name: /tap to remove/iu }))
      .not.toBeInTheDocument();

    await expect.element(page.getByRole("button", { name: /check/iu })).toBeDisabled();
  });

  it("shows reading word translations from the prompt sentence", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        kind: "reading",
        steps: [
          buildSerializedStep({
            content: {},
            kind: "reading",
            sentence: buildSerializedSentence({
              sentence: "Hola mundo",
              translation: "Hello world",
            }),
            sentenceWordOptions: [
              buildWordBankOption({ translation: "Hello", word: "Hola" }),
              buildWordBankOption({ translation: "world", word: "mundo" }),
            ],
            wordBankOptions: [
              buildWordBankOption({ word: "Hola" }),
              buildWordBankOption({ word: "mundo" }),
              buildWordBankOption({ word: "gato" }),
            ],
          }),
        ],
      }),
      viewer: buildAuthenticatedViewer(),
    });

    await page.getByRole("button", { exact: true, name: "Hello" }).click();

    const translationPopover = page.getByRole("dialog", { name: "Hola" });

    await expect.element(translationPopover).toBeInTheDocument();

    await expect.element(translationPopover.getByText("Hola", { exact: true })).toBeInTheDocument();
  });

  it("renders listening audio controls and completes from the word bank flow", async () => {
    await runInMobilePlayerViewport(async () => {
      renderPlayer({
        lesson: buildSerializedLesson({
          kind: "listening",
          steps: [
            buildSerializedStep({
              content: {},
              kind: "listening",
              sentence: buildSerializedSentence({
                audioUrl: "https://example.com/audio.mp3",
                sentence: "Hola mundo",
                translation: "Hello world",
              }),
              wordBankOptions: [
                buildWordBankOption({ word: "Hello" }),
                buildWordBankOption({ word: "world" }),
                buildWordBankOption({ word: "bird" }),
              ],
            }),
          ],
        }),
        viewer: buildAuthenticatedViewer(),
      });

      const controls = page.getByRole("toolbar", { name: /lesson controls/iu });

      await expect
        .element(controls.getByRole("button", { name: /play pronunciation/iu }))
        .toBeInTheDocument();

      await expect.element(controls.getByRole("button", { name: /check/iu })).toBeDisabled();

      await controls.getByRole("button", { name: /play pronunciation/iu }).click();

      await expect
        .element(controls.getByRole("button", { name: /pause pronunciation/iu }))
        .toBeInTheDocument();

      const wordBank = page.getByRole("group", { name: /word bank/iu });

      await wordBank.getByRole("button", { exact: true, name: "Hello" }).click();
      await wordBank.getByRole("button", { exact: true, name: "world" }).click();
      await controls.getByRole("button", { name: /check/iu }).click();
      await controls.getByRole("button", { name: /continue/iu }).click();

      await expect.element(page.getByText("100%")).toBeInTheDocument();
    });
  });

  it("plays listening prompt audio from the P keyboard shortcut", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        kind: "listening",
        steps: [
          buildSerializedStep({
            content: {},
            kind: "listening",
            sentence: buildSerializedSentence({
              audioUrl: "https://example.com/audio.mp3",
              sentence: "Hola mundo",
              translation: "Hello world",
            }),
            wordBankOptions: [
              buildWordBankOption({ word: "Hello" }),
              buildWordBankOption({ word: "world" }),
              buildWordBankOption({ word: "bird" }),
            ],
          }),
        ],
      }),
      viewer: buildAuthenticatedViewer(),
    });

    fireEvent.keyDown(globalThis.window, { key: "p" });

    await expect
      .element(page.getByRole("button", { name: /pause pronunciation/iu }))
      .toBeInTheDocument();

    await expect.element(page.getByRole("button", { name: /check/iu })).toBeDisabled();
  });

  it("lets learners remove fill-blank words before checking and shows the correct-answer hint", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        steps: [
          buildSerializedStep({
            content: {
              answers: ["blue"],
              distractors: ["red"],
              feedback: "Try again",
              question: "Fill the blank",
              template: "The sky is [BLANK]",
            },
            fillBlankOptions: [
              buildWordBankOption({ word: "blue" }),
              buildWordBankOption({ word: "red" }),
            ],
            kind: "fillBlank",
          }),
        ],
      }),
      viewer: buildAuthenticatedViewer(),
    });

    const wordBank = page.getByRole("group", { name: /word bank/iu });

    await wordBank.getByRole("button", { name: "red" }).click();
    await expect.element(page.getByRole("button", { name: /check/iu })).toBeEnabled();

    await page.getByRole("button", { name: /tap to remove/iu }).click();
    await expect.element(page.getByRole("button", { name: /check/iu })).toBeDisabled();

    await wordBank.getByRole("button", { name: "red" }).click();
    await page.getByRole("button", { name: /check/iu }).click();

    const feedback = page.getByRole("region", { name: /answer feedback/iu });

    await expect.element(feedback).toBeInTheDocument();
    await expect.element(feedback.getByText(/correct answer:/iu)).toBeInTheDocument();
  });

  it("shows reading correction feedback and romanization for wrong arrangements", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        kind: "reading",
        steps: [
          buildSerializedStep({
            content: {},
            kind: "reading",
            sentence: buildSerializedSentence({
              explanation: "The sentence keeps the greeting first.",
              romanization: "OH-la MUN-do",
              sentence: "Hola mundo",
              translation: "Hello world",
            }),
            wordBankOptions: [
              buildWordBankOption({ word: "mundo" }),
              buildWordBankOption({ word: "Hola" }),
              buildWordBankOption({ word: "gato" }),
            ],
          }),
        ],
      }),
      viewer: buildAuthenticatedViewer(),
    });

    const wordBank = page.getByRole("group", { name: /word bank/iu });

    await wordBank.getByRole("button", { exact: true, name: "mundo" }).click();
    await wordBank.getByRole("button", { exact: true, name: "Hola" }).click();
    await page.getByRole("button", { name: /check/iu }).click();

    await expect.element(page.getByText(/correct answer:/iu)).toBeInTheDocument();
    await expect.element(page.getByText("Hola mundo")).toBeInTheDocument();
    await expect.element(page.getByText("OH-la MUN-do")).toBeInTheDocument();

    await expect
      .element(page.getByText("The sentence keeps the greeting first."))
      .toBeInTheDocument();
  });

  it("falls back to sentence text when listening audio is missing", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        kind: "listening",
        steps: [
          buildSerializedStep({
            content: {},
            kind: "listening",
            sentence: buildSerializedSentence({
              audioUrl: null,
              sentence: "Hola mundo",
              translation: "Hello world",
            }),
            wordBankOptions: [
              buildWordBankOption({ word: "Hello" }),
              buildWordBankOption({ word: "world" }),
              buildWordBankOption({ word: "bird" }),
            ],
          }),
        ],
      }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect.element(page.getByText("Hola mundo")).toBeInTheDocument();

    await expect
      .element(page.getByRole("button", { name: /play pronunciation/iu }))
      .not.toBeInTheDocument();

    const wordBank = page.getByRole("group", { name: /word bank/iu });

    await wordBank.getByRole("button", { exact: true, name: "Hello" }).click();
    await wordBank.getByRole("button", { exact: true, name: "world" }).click();
    await page.getByRole("button", { name: /check/iu }).click();

    await expect.element(page.getByText(/translate:/iu)).toBeInTheDocument();
    await expect.element(page.getByText("Hola mundo")).toBeInTheDocument();
  });
});

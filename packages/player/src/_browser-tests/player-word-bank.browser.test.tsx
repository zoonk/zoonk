import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import {
  buildSerializedLesson,
  buildSerializedSentence,
  buildSerializedStep,
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
              { audioUrl: null, romanization: null, translation: null, word: "cat" },
              { audioUrl: null, romanization: null, translation: null, word: "mat" },
              { audioUrl: null, romanization: null, translation: null, word: "dog" },
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
    await expect.element(page.getByText("1/1")).toBeInTheDocument();
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
              { audioUrl: null, romanization: null, translation: null, word: "Hola" },
              { audioUrl: null, romanization: null, translation: null, word: "mundo" },
              { audioUrl: null, romanization: null, translation: null, word: "gato" },
            ],
          }),
        ],
      }),
      viewer: buildAuthenticatedViewer(),
    });

    const wordBank = page.getByRole("group", { name: /word bank/iu });

    await wordBank.getByRole("button", { exact: true, name: "Hola" }).click();
    await wordBank.getByRole("button", { exact: true, name: "mundo" }).click();
    await page.getByRole("button", { name: /check/iu }).click();

    await expect.element(page.getByRole("button", { name: /continue/iu })).toBeInTheDocument();
    await page.getByRole("button", { name: /continue/iu }).click();
    await expect.element(page.getByText("1/1")).toBeInTheDocument();
  });

  it("renders listening audio controls and completes from the word bank flow", async () => {
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
              { audioUrl: null, romanization: null, translation: null, word: "Hello" },
              { audioUrl: null, romanization: null, translation: null, word: "world" },
              { audioUrl: null, romanization: null, translation: null, word: "bird" },
            ],
          }),
        ],
      }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect
      .element(page.getByRole("button", { name: /play pronunciation/iu }))
      .toBeInTheDocument();

    const wordBank = page.getByRole("group", { name: /word bank/iu });

    await wordBank.getByRole("button", { exact: true, name: "Hello" }).click();
    await wordBank.getByRole("button", { exact: true, name: "world" }).click();
    await page.getByRole("button", { name: /check/iu }).click();
    await page.getByRole("button", { name: /continue/iu }).click();

    await expect.element(page.getByText("1/1")).toBeInTheDocument();
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
              { audioUrl: null, romanization: null, translation: null, word: "blue" },
              { audioUrl: null, romanization: null, translation: null, word: "red" },
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
              { audioUrl: null, romanization: null, translation: null, word: "mundo" },
              { audioUrl: null, romanization: null, translation: null, word: "Hola" },
              { audioUrl: null, romanization: null, translation: null, word: "gato" },
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
              { audioUrl: null, romanization: null, translation: null, word: "Hello" },
              { audioUrl: null, romanization: null, translation: null, word: "world" },
              { audioUrl: null, romanization: null, translation: null, word: "bird" },
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

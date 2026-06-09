import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { buildInlineImageUrl } from "../_test-utils/build-inline-image-url";
import {
  buildSerializedLesson,
  buildSerializedStep,
  buildSerializedWord,
} from "../_test-utils/player-test-data";
import { buildAuthenticatedViewer } from "../_test-utils/player-test-viewer";
import { renderPlayer } from "../_test-utils/render-player";

describe("player browser integration: choice steps", () => {
  it("completes a multiple-choice step through the real provider and shell", async () => {
    const onComplete = vi.fn();

    renderPlayer({
      lesson: buildSerializedLesson({
        steps: [
          buildSerializedStep({
            content: {
              options: [
                { feedback: "Nope", id: "Paris", isCorrect: false, text: "Paris" },
                { feedback: "Correct", id: "Berlin", isCorrect: true, text: "Berlin" },
              ],
              question: "What is the capital of Germany?",
            },
            kind: "multipleChoice",
          }),
        ],
      }),
      onComplete,
      viewer: buildAuthenticatedViewer(),
    });

    await expect.element(page.getByRole("button", { name: /check/iu })).toBeDisabled();

    await page.getByRole("radio", { name: "Berlin" }).click();
    await expect.element(page.getByRole("button", { name: /check/iu })).toBeEnabled();

    await page.getByRole("button", { name: /check/iu }).click();
    await expect.element(page.getByText(/your answer:/iu)).toBeInTheDocument();

    await page.getByRole("button", { name: /continue/iu }).click();

    await expect.element(page.getByText("100%")).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("renders translation options, plays the selection flow, and completes", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        kind: "translation",
        steps: [
          buildSerializedStep({
            content: {},
            kind: "translation",
            translationOptions: [
              {
                audioUrl: null,
                id: "target-word",
                pronunciation: null,
                romanization: "beru-rin",
                word: "Berlin",
              },
              {
                audioUrl: null,
                id: "word-2",
                pronunciation: null,
                romanization: "pari",
                word: "Paris",
              },
              {
                audioUrl: null,
                id: "word-3",
                pronunciation: null,
                romanization: "madorido",
                word: "Madrid",
              },
              {
                audioUrl: null,
                id: "word-4",
                pronunciation: null,
                romanization: "roma",
                word: "Rome",
              },
            ],
            word: buildSerializedWord({
              id: "target-word",
              romanization: "beru-rin",
              translation: "Capital of Germany",
              word: "Berlin",
            }),
          }),
        ],
      }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect.element(page.getByText(/translate this word:/iu)).toBeInTheDocument();
    await page.getByRole("radio", { name: /berlin/iu }).click();
    await page.getByRole("button", { name: /check/iu }).click();
    await expect.element(page.getByText(/your answer:/iu)).toBeInTheDocument();

    await page.getByRole("button", { name: /continue/iu }).click();
    await expect.element(page.getByText("100%")).toBeInTheDocument();
  });

  it("selects an image option and shows inline feedback", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        steps: [
          buildSerializedStep({
            content: {
              options: [
                {
                  feedback: "Correct cat",
                  id: "cat",
                  isCorrect: true,
                  prompt: "Cat",
                  url: "https://example.com/cat.png",
                },
                {
                  feedback: "Wrong dog",
                  id: "dog",
                  isCorrect: false,
                  prompt: "Dog",
                  url: "https://example.com/dog.png",
                },
              ],
              question: "Select the cat",
            },
            kind: "selectImage",
          }),
        ],
      }),
      viewer: buildAuthenticatedViewer(),
    });

    await page.getByRole("radio", { name: "Cat" }).click();
    await page.getByRole("button", { name: /check/iu }).click();

    await expect
      .element(page.getByRole("region", { name: /answer feedback/iu }))
      .toBeInTheDocument();
  });

  it("lets multiple-choice users toggle selections and shows the correct answer on mistakes", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        steps: [
          buildSerializedStep({
            content: {
              context: "Read the clue first",
              options: [
                { feedback: "Nope", id: "Paris", isCorrect: false, text: "Paris" },
                { feedback: "Correct", id: "Berlin", isCorrect: true, text: "Berlin" },
              ],
              question: "What is the capital of Germany?",
            },
            kind: "multipleChoice",
          }),
        ],
      }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect.element(page.getByText("Read the clue first")).toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: /check/iu })).toBeDisabled();

    fireEvent.keyDown(globalThis.window, { key: "2" });

    await expect
      .element(page.getByRole("radio", { name: "Berlin" }))
      .toHaveAttribute("aria-checked", "true");

    await expect.element(page.getByRole("button", { name: /check/iu })).toBeEnabled();

    await page.getByRole("radio", { name: "Berlin" }).click();

    await expect
      .element(page.getByRole("radio", { name: "Berlin" }))
      .toHaveAttribute("aria-checked", "false");

    await expect.element(page.getByRole("button", { name: /check/iu })).toBeDisabled();

    await page.getByRole("radio", { name: "Paris" }).click();
    await page.getByRole("button", { name: /check/iu }).click();

    await expect.element(page.getByText(/your answer:/iu)).toBeInTheDocument();
    await expect.element(page.getByText(/correct answer:/iu)).toBeInTheDocument();
    await expect.element(page.getByText("Paris")).toBeInTheDocument();
    await expect.element(page.getByText("Berlin")).toBeInTheDocument();
  });

  it("strips model-added wrapping quotes from multiple-choice option labels", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        steps: [
          buildSerializedStep({
            content: {
              options: [
                { feedback: "Nope", id: "Paris", isCorrect: false, text: '"Paris"' },
                { feedback: "Correct", id: "Berlin", isCorrect: true, text: "“Berlin”" },
              ],
              question: "What is the capital of Germany?",
            },
            kind: "multipleChoice",
          }),
        ],
      }),
      viewer: buildAuthenticatedViewer(),
    });

    const parisOption = page.getByRole("radio", { name: "Paris" });
    const berlinOption = page.getByRole("radio", { name: "Berlin" });

    await expect.element(parisOption.getByText(/^Paris$/u)).toBeInTheDocument();
    await expect.element(berlinOption.getByText(/^Berlin$/u)).toBeInTheDocument();

    await parisOption.click();

    await expect.element(page.getByRole("button", { name: /check/iu })).toBeEnabled();
  });

  it("renders image-led multiple-choice evidence inline", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        steps: [
          buildSerializedStep({
            content: {
              context: "Use the chart before choosing.",
              image: {
                prompt: "A sales chart with a visible drop in March",
                url: buildInlineImageUrl({ label: "A sales chart with a visible drop in March" }),
              },
              options: [
                {
                  feedback: "Correct",
                  id: "March dropped sharply",
                  isCorrect: true,
                  text: "March dropped sharply",
                },
                {
                  feedback: "Nope",
                  id: "March stayed flat",
                  isCorrect: false,
                  text: "March stayed flat",
                },
              ],
              question: "What changed?",
            },
            kind: "multipleChoice",
          }),
        ],
      }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect
      .element(page.getByAltText(/sales chart with a visible drop in march/iu))
      .toBeInTheDocument();
  });

  it("shows translation pronunciation, romanization, and feedback audio without app wiring", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        kind: "translation",
        steps: [
          buildSerializedStep({
            content: {},
            kind: "translation",
            translationOptions: [
              {
                audioUrl: "https://example.com/berlin.mp3",
                id: "target-word",
                pronunciation: "BEHR-lin",
                romanization: "beru-rin",
                word: "Berlin",
              },
              {
                audioUrl: null,
                id: "word-2",
                pronunciation: null,
                romanization: "pari",
                word: "Paris",
              },
              {
                audioUrl: null,
                id: "word-3",
                pronunciation: null,
                romanization: "roma",
                word: "Rome",
              },
              {
                audioUrl: null,
                id: "word-4",
                pronunciation: null,
                romanization: "madorido",
                word: "Madrid",
              },
            ],
            word: buildSerializedWord({
              audioUrl: "https://example.com/berlin.mp3",
              id: "target-word",
              pronunciation: "BEHR-lin",
              romanization: "beru-rin",
              translation: "Capital of Germany",
              word: "Berlin",
            }),
          }),
        ],
      }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect.element(page.getByText("beru-rin")).toBeInTheDocument();

    await page.getByRole("radio", { name: /berlin/iu }).click();
    await expect.element(page.getByText("BEHR-lin")).toBeInTheDocument();

    await page.getByRole("button", { name: /check/iu }).click();

    await expect.element(page.getByText(/translate:/iu)).toBeInTheDocument();
    await expect.element(page.getByText("Capital of Germany")).toBeInTheDocument();
    await expect.element(page.getByText("beru-rin")).toBeInTheDocument();

    await expect
      .element(page.getByRole("button", { name: /play pronunciation/iu }))
      .toBeInTheDocument();
  });

  it("falls back to prompt text for missing select-image URLs and highlights the correct answer", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        steps: [
          buildSerializedStep({
            content: {
              options: [
                {
                  feedback: "Correct cat",
                  id: "cat",
                  isCorrect: true,
                  prompt: "Cat",
                  url: undefined,
                },
                {
                  feedback: "Wrong dog",
                  id: "dog",
                  isCorrect: false,
                  prompt: "Dog",
                  url: "https://example.com/dog.png",
                },
              ],
              question: "Select the cat",
            },
            kind: "selectImage",
          }),
        ],
      }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect
      .element(page.getByRole("radiogroup", { name: /image options/iu }).getByText("Cat"))
      .toBeInTheDocument();

    await page.getByRole("radio", { name: "Dog" }).click();
    await page.getByRole("button", { name: /check/iu }).click();

    await expect
      .element(page.getByRole("region", { name: /answer feedback/iu }))
      .toBeInTheDocument();

    await expect.element(page.getByRole("radio", { name: "Cat" })).toBeInTheDocument();
    await expect.element(page.getByText(/correct answer/iu)).toBeInTheDocument();
    await expect.element(page.getByText(/your answer/iu)).toBeInTheDocument();
  });

  it("replaces {{NAME}} placeholders for authenticated viewers", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        steps: [
          buildSerializedStep({
            content: {
              context: "{{NAME}}, we have a situation",
              options: [
                {
                  feedback: "{{NAME}}, great call",
                  id: "Investigate",
                  isCorrect: true,
                  text: "Investigate",
                },
                { feedback: "Wrong", id: "Ignore it", isCorrect: false, text: "Ignore it" },
              ],
              question: "What should we do?",
            },
            kind: "multipleChoice",
          }),
        ],
      }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect.element(page.getByText(/Alex, we have a situation/iu)).toBeInTheDocument();
    await page.getByRole("radio", { name: "Investigate" }).click();
    await page.getByRole("button", { name: /check/iu }).click();
    await expect.element(page.getByText(/Alex, great call/iu)).toBeInTheDocument();
  });

  it("strips {{NAME}} placeholders for unauthenticated viewers", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        steps: [
          buildSerializedStep({
            content: {
              context: "{{NAME}}, we have a situation",
              options: [
                {
                  feedback: "{{NAME}}, great call",
                  id: "Investigate",
                  isCorrect: true,
                  text: "Investigate",
                },
                { feedback: "Wrong", id: "Ignore it", isCorrect: false, text: "Ignore it" },
              ],
              question: "What should we do?",
            },
            kind: "multipleChoice",
          }),
        ],
      }),
    });

    await expect.element(page.getByText(/^we have a situation$/iu)).toBeInTheDocument();
    await expect.element(page.getByText("{{NAME}}")).not.toBeInTheDocument();

    await page.getByRole("radio", { name: "Investigate" }).click();
    await page.getByRole("button", { name: /check/iu }).click();

    await expect.element(page.getByText(/^great call$/iu)).toBeInTheDocument();
    await expect.element(page.getByText("{{NAME}}")).not.toBeInTheDocument();
  });
});

import { fireEvent } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { buildInlineImageUrl } from "../_test-utils/build-inline-image-url";
import {
  buildSerializedActivity,
  buildSerializedStep,
  buildSerializedWord,
} from "../_test-utils/player-test-data";
import { buildAuthenticatedViewer } from "../_test-utils/player-test-viewer";
import { renderPlayer } from "../_test-utils/render-player";

describe("player browser integration: choice steps", () => {
  test("completes a multiple-choice step through the real provider and shell", async () => {
    const onComplete = vi.fn();

    renderPlayer({
      activity: buildSerializedActivity({
        steps: [
          buildSerializedStep({
            content: {
              kind: "core",
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

    await expect.element(page.getByRole("button", { name: /check/i })).toBeDisabled();

    await page.getByRole("radio", { name: "Berlin" }).click();
    await expect.element(page.getByRole("button", { name: /check/i })).toBeEnabled();

    await page.getByRole("button", { name: /check/i }).click();
    await expect.element(page.getByText(/your answer:/i)).toBeInTheDocument();

    await page.getByRole("button", { name: /continue/i }).click();

    await expect.element(page.getByText("1/1")).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledOnce();
  });

  test("renders translation options, plays the selection flow, and completes", async () => {
    renderPlayer({
      activity: buildSerializedActivity({
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

    await expect.element(page.getByText(/translate this word:/i)).toBeInTheDocument();
    await page.getByRole("radio", { name: /berlin/i }).click();
    await page.getByRole("button", { name: /check/i }).click();
    await expect.element(page.getByText(/your answer:/i)).toBeInTheDocument();

    await page.getByRole("button", { name: /continue/i }).click();
    await expect.element(page.getByText("1/1")).toBeInTheDocument();
  });

  test("selects an image option and shows inline feedback", async () => {
    renderPlayer({
      activity: buildSerializedActivity({
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
    await page.getByRole("button", { name: /check/i }).click();
    await expect
      .element(page.getByRole("region", { name: /answer feedback/i }))
      .toBeInTheDocument();
  });

  test("lets multiple-choice users toggle selections and shows the correct answer on mistakes", async () => {
    renderPlayer({
      activity: buildSerializedActivity({
        steps: [
          buildSerializedStep({
            content: {
              context: "Read the clue first",
              kind: "core",
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
    await expect.element(page.getByRole("button", { name: /check/i })).toBeDisabled();

    fireEvent.keyDown(globalThis.window, { key: "2" });
    await expect
      .element(page.getByRole("radio", { name: "Berlin" }))
      .toHaveAttribute("aria-checked", "true");
    await expect.element(page.getByRole("button", { name: /check/i })).toBeEnabled();

    await page.getByRole("radio", { name: "Berlin" }).click();
    await expect
      .element(page.getByRole("radio", { name: "Berlin" }))
      .toHaveAttribute("aria-checked", "false");
    await expect.element(page.getByRole("button", { name: /check/i })).toBeDisabled();

    await page.getByRole("radio", { name: "Paris" }).click();
    await page.getByRole("button", { name: /check/i }).click();

    await expect.element(page.getByText(/your answer:/i)).toBeInTheDocument();
    await expect.element(page.getByText(/correct answer:/i)).toBeInTheDocument();
    await expect.element(page.getByText("Paris")).toBeInTheDocument();
    await expect.element(page.getByText("Berlin")).toBeInTheDocument();
  });

  test("lets users expand image-led multiple-choice evidence", async () => {
    renderPlayer({
      activity: buildSerializedActivity({
        steps: [
          buildSerializedStep({
            content: {
              context: "Use the chart before choosing.",
              image: {
                prompt: "A sales chart with a visible drop in March",
                url: buildInlineImageUrl({ label: "A sales chart with a visible drop in March" }),
              },
              kind: "core",
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
      .element(page.getByAltText(/sales chart with a visible drop in march/i))
      .toBeInTheDocument();

    await page.getByRole("button", { name: /open full image/i }).click();

    const dialog = page.getByRole("dialog", { name: /full image/i });

    await expect
      .element(dialog.getByAltText(/sales chart with a visible drop in march/i))
      .toBeInTheDocument();

    await page.getByRole("button", { name: /close full image/i }).click();
    await expect.element(dialog).not.toBeInTheDocument();
  });

  test("shows translation pronunciation, romanization, and feedback audio without app wiring", async () => {
    renderPlayer({
      activity: buildSerializedActivity({
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

    await page.getByRole("radio", { name: /berlin/i }).click();
    await expect.element(page.getByText("BEHR-lin")).toBeInTheDocument();

    await page.getByRole("button", { name: /check/i }).click();

    await expect.element(page.getByText(/translate:/i)).toBeInTheDocument();
    await expect.element(page.getByText("Capital of Germany")).toBeInTheDocument();
    await expect.element(page.getByText("beru-rin")).toBeInTheDocument();
    await expect
      .element(page.getByRole("button", { name: /play pronunciation/i }))
      .toBeInTheDocument();
  });

  test("falls back to prompt text for missing select-image URLs and highlights the correct answer", async () => {
    renderPlayer({
      activity: buildSerializedActivity({
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
      .element(page.getByRole("radiogroup", { name: /image options/i }).getByText("Cat"))
      .toBeInTheDocument();

    await page.getByRole("radio", { name: "Dog" }).click();
    await page.getByRole("button", { name: /check/i }).click();

    await expect
      .element(page.getByRole("region", { name: /answer feedback/i }))
      .toBeInTheDocument();
    await expect.element(page.getByRole("radio", { name: "Cat" })).toBeInTheDocument();
  });

  test("replaces {{NAME}} placeholders for authenticated viewers", async () => {
    renderPlayer({
      activity: buildSerializedActivity({
        steps: [
          buildSerializedStep({
            content: {
              context: "{{NAME}}, we have a situation",
              kind: "core",
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

    await expect.element(page.getByText(/Alex, we have a situation/i)).toBeInTheDocument();
    await page.getByRole("radio", { name: "Investigate" }).click();
    await page.getByRole("button", { name: /check/i }).click();
    await expect.element(page.getByText(/Alex, great call/i)).toBeInTheDocument();
  });

  test("strips {{NAME}} placeholders for unauthenticated viewers", async () => {
    renderPlayer({
      activity: buildSerializedActivity({
        steps: [
          buildSerializedStep({
            content: {
              context: "{{NAME}}, we have a situation",
              kind: "core",
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

    await expect.element(page.getByText(/^we have a situation$/i)).toBeInTheDocument();
    await expect.element(page.getByText("{{NAME}}")).not.toBeInTheDocument();

    await page.getByRole("radio", { name: "Investigate" }).click();
    await page.getByRole("button", { name: /check/i }).click();

    await expect.element(page.getByText(/^great call$/i)).toBeInTheDocument();
    await expect.element(page.getByText("{{NAME}}")).not.toBeInTheDocument();
  });
});

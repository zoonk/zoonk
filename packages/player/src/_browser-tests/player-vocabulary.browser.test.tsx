import { fireEvent } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import {
  buildSerializedLesson,
  buildSerializedStep,
  buildSerializedWord,
} from "../_test-utils/player-test-data";
import { buildAuthenticatedViewer } from "../_test-utils/player-test-viewer";
import { buildNavigation, renderPlayer } from "../_test-utils/render-player";

describe("player browser integration: vocabulary", () => {
  test("renders a vocabulary card with pronunciation and translation", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        kind: "translation",
        steps: [
          buildSerializedStep({
            content: {},
            kind: "vocabulary",
            word: buildSerializedWord({
              audioUrl: "https://example.com/audio.mp3",
              pronunciation: "OH-lah",
              romanization: "ola",
              translation: "Hello",
              word: "Hola",
            }),
          }),
        ],
      }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect.element(page.getByText("Hola")).toBeInTheDocument();
    await expect.element(page.getByText(/^ola$/)).toBeInTheDocument();
    await expect.element(page.getByText("OH-lah")).toBeInTheDocument();
    await expect.element(page.getByText("Hello")).toBeInTheDocument();
  });

  test("navigates vocabulary cards without quiz controls", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        kind: "vocabulary",
        steps: [
          buildSerializedStep({
            content: {},
            id: "vocab-1",
            kind: "vocabulary",
            word: buildSerializedWord({
              id: "word-1",
              translation: "Sun",
              word: "Sol",
            }),
          }),
          buildSerializedStep({
            content: {},
            id: "vocab-2",
            kind: "vocabulary",
            position: 1,
            word: buildSerializedWord({
              id: "word-2",
              translation: "Moon",
              word: "Luna",
            }),
          }),
        ],
      }),
      navigation: buildNavigation({ nextLessonHref: null }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect.element(page.getByText("Sol")).toBeInTheDocument();
    await expect.element(page.getByRole("radiogroup")).not.toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: /check/i })).not.toBeInTheDocument();

    fireEvent.keyDown(globalThis.window, { key: "ArrowRight" });
    await expect.element(page.getByText("Luna")).toBeInTheDocument();

    fireEvent.keyDown(globalThis.window, { key: "ArrowLeft" });
    await expect.element(page.getByText("Sol")).toBeInTheDocument();
  });

  test("completes flashcard vocabulary lessons through the shared rewards flow", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        kind: "vocabulary",
        steps: [
          buildSerializedStep({
            content: {},
            kind: "vocabulary",
            word: buildSerializedWord({
              id: "word-1",
              translation: "Cat",
              word: "Gato",
            }),
          }),
        ],
      }),
      navigation: buildNavigation({ nextLessonHref: null }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect.element(page.getByText("Gato")).toBeInTheDocument();

    fireEvent.keyDown(globalThis.window, { key: "ArrowRight" });

    const completionScreen = page.getByRole("status");

    await expect.element(completionScreen).toBeInTheDocument();
    await expect.element(completionScreen.getByText(/\+10\s*BP/i)).toBeInTheDocument();
    await expect
      .element(completionScreen.getByRole("progressbar", { name: /level progress/i }))
      .toBeInTheDocument();
  });
});

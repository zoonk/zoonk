import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { mockNextAudioPlayFailure } from "../_test-utils/browser-setup";
import { runInMobilePlayerViewport } from "../_test-utils/browser-viewport";
import {
  buildSerializedLesson,
  buildSerializedStep,
  buildSerializedWord,
} from "../_test-utils/player-test-data";
import { buildAuthenticatedViewer } from "../_test-utils/player-test-viewer";
import { buildNavigation, renderPlayer } from "../_test-utils/render-player";

describe("player browser integration: vocabulary", () => {
  it("renders a vocabulary card with pronunciation and translation", async () => {
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
    await expect.element(page.getByText(/^ola$/u)).toBeInTheDocument();
    await expect.element(page.getByText("OH-lah")).toBeInTheDocument();
    await expect.element(page.getByText("Hello")).toBeInTheDocument();
  });

  it("plays vocabulary audio without moving to the next card", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        kind: "vocabulary",
        steps: [
          buildSerializedStep({
            content: {},
            id: "vocab-audio-1",
            kind: "vocabulary",
            word: buildSerializedWord({
              audioUrl: "https://example.com/hola.mp3",
              id: "word-audio-1",
              translation: "Hello",
              word: "Hola",
            }),
          }),
          buildSerializedStep({
            content: {},
            id: "vocab-audio-2",
            kind: "vocabulary",
            position: 1,
            word: buildSerializedWord({
              audioUrl: "https://example.com/adios.mp3",
              id: "word-audio-2",
              translation: "Goodbye",
              word: "Adios",
            }),
          }),
        ],
      }),
      navigation: buildNavigation({ nextLessonHref: null }),
      viewer: buildAuthenticatedViewer(),
    });

    const currentCard = page.getByRole("region", { name: /vocabulary: Hola/iu });

    await currentCard.getByRole("button", { name: /play pronunciation/iu }).click();

    await expect
      .element(currentCard.getByRole("button", { name: /pause pronunciation/iu }))
      .toBeInTheDocument();

    await expect.element(currentCard).toBeInTheDocument();

    await expect
      .element(page.getByRole("region", { name: /vocabulary: Adios/iu }))
      .not.toBeInTheDocument();
  });

  it("automatically plays the next vocabulary prompt after audio is started", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        kind: "vocabulary",
        steps: [
          buildSerializedStep({
            content: {},
            id: "vocab-autoplay-1",
            kind: "vocabulary",
            word: buildSerializedWord({
              audioUrl: "https://example.com/hola.mp3",
              id: "word-autoplay-1",
              translation: "Hello",
              word: "Hola",
            }),
          }),
          buildSerializedStep({
            content: {},
            id: "vocab-autoplay-2",
            kind: "vocabulary",
            position: 1,
            word: buildSerializedWord({
              audioUrl: "https://example.com/adios.mp3",
              id: "word-autoplay-2",
              translation: "Goodbye",
              word: "Adios",
            }),
          }),
        ],
      }),
      navigation: buildNavigation({ nextLessonHref: null }),
      viewer: buildAuthenticatedViewer(),
    });

    const firstCard = page.getByRole("region", { name: /vocabulary: Hola/iu });

    await firstCard.getByRole("button", { name: /play pronunciation/iu }).click();

    await expect
      .element(firstCard.getByRole("button", { name: /pause pronunciation/iu }))
      .toBeInTheDocument();

    fireEvent.keyDown(globalThis.window, { key: "ArrowRight" });

    const secondCard = page.getByRole("region", { name: /vocabulary: Adios/iu });

    await expect
      .element(secondCard.getByRole("button", { name: /pause pronunciation/iu }))
      .toBeInTheDocument();
  });

  it("keeps the play control ready when automatic vocabulary audio is blocked", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        kind: "vocabulary",
        steps: [
          buildSerializedStep({
            content: {},
            id: "vocab-blocked-autoplay-1",
            kind: "vocabulary",
            word: buildSerializedWord({
              audioUrl: "https://example.com/hola.mp3",
              id: "word-blocked-autoplay-1",
              translation: "Hello",
              word: "Hola",
            }),
          }),
          buildSerializedStep({
            content: {},
            id: "vocab-blocked-autoplay-2",
            kind: "vocabulary",
            position: 1,
            word: buildSerializedWord({
              audioUrl: "https://example.com/adios.mp3",
              id: "word-blocked-autoplay-2",
              translation: "Goodbye",
              word: "Adios",
            }),
          }),
        ],
      }),
      navigation: buildNavigation({ nextLessonHref: null }),
      viewer: buildAuthenticatedViewer(),
    });

    const firstCard = page.getByRole("region", { name: /vocabulary: Hola/iu });

    await firstCard.getByRole("button", { name: /play pronunciation/iu }).click();

    await expect
      .element(firstCard.getByRole("button", { name: /pause pronunciation/iu }))
      .toBeInTheDocument();

    mockNextAudioPlayFailure();
    fireEvent.keyDown(globalThis.window, { key: "ArrowRight" });

    const secondCard = page.getByRole("region", { name: /vocabulary: Adios/iu });

    await expect
      .element(secondCard.getByRole("button", { name: /play pronunciation/iu }))
      .toBeInTheDocument();

    await expect
      .element(secondCard.getByRole("button", { name: /pause pronunciation/iu }))
      .not.toBeInTheDocument();
  });

  it("plays vocabulary audio from the mobile bottom bar", async () => {
    await runInMobilePlayerViewport(async () => {
      renderPlayer({
        lesson: buildSerializedLesson({
          kind: "vocabulary",
          steps: [
            buildSerializedStep({
              content: {},
              id: "vocab-bottom-audio-1",
              kind: "vocabulary",
              word: buildSerializedWord({
                audioUrl: "https://example.com/hola.mp3",
                id: "word-bottom-audio-1",
                translation: "Hello",
                word: "Hola",
              }),
            }),
            buildSerializedStep({
              content: {},
              id: "vocab-bottom-audio-2",
              kind: "vocabulary",
              position: 1,
              word: buildSerializedWord({
                audioUrl: "https://example.com/adios.mp3",
                id: "word-bottom-audio-2",
                translation: "Goodbye",
                word: "Adios",
              }),
            }),
          ],
        }),
        navigation: buildNavigation({ nextLessonHref: null }),
        viewer: buildAuthenticatedViewer(),
      });

      const controls = page.getByRole("toolbar", { name: /player controls/iu });
      const currentCard = page.getByRole("region", { name: /vocabulary: Hola/iu });

      await controls.getByRole("button", { name: /play pronunciation/iu }).click();

      await expect
        .element(controls.getByRole("button", { name: /pause pronunciation/iu }))
        .toBeInTheDocument();

      await expect
        .element(currentCard.getByRole("button", { name: /pause pronunciation/iu }))
        .toBeInTheDocument();

      await expect
        .element(page.getByRole("region", { name: /vocabulary: Adios/iu }))
        .not.toBeInTheDocument();
    });
  });

  it("navigates vocabulary cards without quiz controls", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        kind: "vocabulary",
        steps: [
          buildSerializedStep({
            content: {},
            id: "vocab-1",
            kind: "vocabulary",
            word: buildSerializedWord({ id: "word-1", translation: "Sun", word: "Sol" }),
          }),
          buildSerializedStep({
            content: {},
            id: "vocab-2",
            kind: "vocabulary",
            position: 1,
            word: buildSerializedWord({ id: "word-2", translation: "Moon", word: "Luna" }),
          }),
        ],
      }),
      navigation: buildNavigation({ nextLessonHref: null }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect.element(page.getByText("Sol")).toBeInTheDocument();
    await expect.element(page.getByRole("radiogroup")).not.toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: /check/iu })).not.toBeInTheDocument();

    fireEvent.keyDown(globalThis.window, { key: "ArrowRight" });
    await expect.element(page.getByText("Luna")).toBeInTheDocument();

    fireEvent.keyDown(globalThis.window, { key: "ArrowLeft" });
    await expect.element(page.getByText("Sol")).toBeInTheDocument();
  });

  it("completes flashcard vocabulary lessons through the shared completion flow", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        kind: "vocabulary",
        steps: [
          buildSerializedStep({
            content: {},
            kind: "vocabulary",
            word: buildSerializedWord({ id: "word-1", translation: "Cat", word: "Gato" }),
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
    await expect.element(completionScreen.getByText(/\+10\s*BP/iu)).not.toBeInTheDocument();

    await expect
      .element(completionScreen.getByRole("progressbar", { name: /level progress/iu }))
      .not.toBeInTheDocument();
  });
});

import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { buildSerializedLesson, buildSerializedStep } from "../_test-utils/player-test-data";
import { buildAuthenticatedViewer } from "../_test-utils/player-test-viewer";
import { buildNavigation, renderPlayer } from "../_test-utils/render-player";

describe("player browser integration: alphabet", () => {
  it("shows the alphabet intro before the learner reaches symbol cards", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        kind: "alphabet",
        steps: [
          buildSerializedStep({
            content: {
              text: "Hangul letters combine into syllable blocks.",
              title: "How syllable blocks work",
              variant: "text",
            },
            id: "intro",
            kind: "static",
          }),
          buildSerializedStep({
            content: {
              audioText: "ㄱ",
              audioUrl: null,
              forms: [],
              pronunciation: "plain unaspirated k/g sound",
              readingAid: "g/k",
              symbol: "ㄱ",
            },
            id: "symbol",
            kind: "alphabet",
            position: 1,
          }),
        ],
      }),
      navigation: buildNavigation({ nextLessonHref: null }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect
      .element(page.getByRole("heading", { name: "How syllable blocks work" }))
      .toBeInTheDocument();

    await expect
      .element(page.getByText("Hangul letters combine into syllable blocks."))
      .toBeInTheDocument();

    fireEvent.keyDown(globalThis.window, { key: "ArrowRight" });
    await expect.element(page.getByRole("region", { name: /alphabet: ㄱ/iu })).toBeInTheDocument();
  });

  it("renders a writing-system card with reading aid and forms", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        kind: "alphabet",
        steps: [
          buildSerializedStep({
            content: {
              audioText: "ب",
              audioUrl: "https://example.com/ba.mp3",
              forms: [
                { label: "isolated", symbol: "ب" },
                { label: "initial", symbol: "بـ" },
              ],
              pronunciation: "like b in book",
              readingAid: "b",
              symbol: "ب",
            },
            kind: "alphabet",
          }),
        ],
      }),
      viewer: buildAuthenticatedViewer(),
    });

    const card = page.getByRole("region", { name: /alphabet: ب/iu });

    await expect.element(card).toBeInTheDocument();
    await expect.element(card.getByText(/^b$/u)).toBeInTheDocument();
    await expect.element(card.getByText("like b in book")).toBeInTheDocument();
    await expect.element(card.getByText("initial")).toBeInTheDocument();
    await expect.element(card.getByText("بـ")).toBeInTheDocument();
  });

  it("navigates alphabet cards without quiz controls", async () => {
    renderPlayer({
      lesson: buildSerializedLesson({
        kind: "alphabet",
        steps: [
          buildSerializedStep({
            content: {
              audioText: "あ",
              audioUrl: null,
              forms: [],
              pronunciation: "like a in father",
              readingAid: "a",
              symbol: "あ",
            },
            id: "alphabet-1",
            kind: "alphabet",
          }),
          buildSerializedStep({
            content: {
              audioText: "い",
              audioUrl: null,
              forms: [],
              pronunciation: "like ee in see",
              readingAid: "i",
              symbol: "い",
            },
            id: "alphabet-2",
            kind: "alphabet",
            position: 1,
          }),
        ],
      }),
      navigation: buildNavigation({ nextLessonHref: null }),
      viewer: buildAuthenticatedViewer(),
    });

    await expect.element(page.getByText("あ")).toBeInTheDocument();
    await expect.element(page.getByRole("radiogroup")).not.toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: /check/iu })).not.toBeInTheDocument();

    fireEvent.keyDown(globalThis.window, { key: "ArrowRight" });
    await expect.element(page.getByText("い")).toBeInTheDocument();
  });
});

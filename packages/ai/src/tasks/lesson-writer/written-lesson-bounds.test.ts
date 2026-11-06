import { describe, expect, it } from "vitest";
import { MAX_IMAGE_ALT_LENGTH, MAX_IMAGE_PROMPT_LENGTH } from "../images/image-request-schema";
import { fitWrittenBounds } from "./written-lesson-bounds";
import { MAX_CHECK_OPTIONS, MAX_GUESS_OPTIONS } from "./written-lesson-schema";

function option(text: string, isCorrect: boolean) {
  return { isCorrect, reason: `Why ${text}.`, text };
}

function screensOf(value: unknown): Record<string, unknown>[] {
  return (value as { screens: Record<string, unknown>[] }).screens;
}

function firstScreen(value: unknown): Record<string, unknown> {
  return screensOf(value)[0] ?? {};
}

describe(fitWrittenBounds, () => {
  it("ends an alt one word too long on the last whole word that fits", () => {
    // Terra wrote an alt just over the limit on en-particle-in-a-box-advanced (3 Nov 2026).
    const alt =
      "Two energy ladders side by side: a narrow box with widely spaced rungs and a wide box with closely spaced rungs, and each rung is labeled with its level number n.";

    expect(alt.length).toBeGreaterThan(MAX_IMAGE_ALT_LENGTH);

    const screen = firstScreen(
      fitWrittenBounds({
        screens: [{ image: { alt, prompt: "Two energy ladders." }, kind: "hookText", text: "Hi" }],
      }),
    );

    const fitted = (screen.image as { alt: string }).alt;

    expect(fitted).toBe(
      "Two energy ladders side by side: a narrow box with widely spaced rungs and a wide box with closely spaced rungs, and each rung is labeled with its level…",
    );
  });

  it("shortens a picture's prompt and an option's picture the same way", () => {
    const prompt = `${"a red apple on a table ".repeat(20)}end`;
    const longAlt = "word ".repeat(40).trim();

    const screen = firstScreen(
      fitWrittenBounds({
        screens: [
          {
            image: { alt: "Short.", prompt },
            kind: "check",
            options: [
              { ...option("Maple", true), picture: { alt: longAlt, prompt: "A leaf." } },
              { ...option("Oak", false), picture: null },
            ],
          },
        ],
      }),
    );

    const image = screen.image as { alt: string; prompt: string };
    const [maple, oak] = screen.options as { picture: { alt: string } | null }[];

    expect(image.alt).toBe("Short.");
    expect(image.prompt.length).toBeLessThanOrEqual(MAX_IMAGE_PROMPT_LENGTH);
    expect(maple?.picture?.alt.length).toBeLessThanOrEqual(MAX_IMAGE_ALT_LENGTH);
    expect(oak?.picture).toBeNull();
  });

  it("drops a guess's surplus wrong options from the end and keeps the right one", () => {
    // Terra wrote five options on a guess on pt-precisao-sensores (3 Nov 2026).
    const screen = firstScreen(
      fitWrittenBounds({
        screens: [
          {
            kind: "hookGuess",
            options: [
              option("A", false),
              option("B", false),
              option("C", false),
              option("D", false),
              option("E", true),
            ],
          },
        ],
      }),
    );

    expect(screen.options).toStrictEqual([
      option("A", false),
      option("B", false),
      option("C", false),
      option("E", true),
    ]);

    expect(screen.options).toHaveLength(MAX_GUESS_OPTIONS);
  });

  it("drops a check's surplus wrong options down to its own limit", () => {
    const options = [true, false, false, false, false, false, false].map((isCorrect, index) =>
      option(String(index), isCorrect),
    );

    const screen = firstScreen(fitWrittenBounds({ screens: [{ kind: "check", options }] }));

    expect(screen.options).toStrictEqual(options.slice(0, MAX_CHECK_OPTIONS));
  });

  it("leaves options alone when only dropping a right one would make them fit", () => {
    const options = [true, true, true, true, true, true, false].map((isCorrect, index) =>
      option(String(index), isCorrect),
    );

    const screen = firstScreen(fitWrittenBounds({ screens: [{ kind: "check", options }] }));

    expect(screen.options).toStrictEqual(options);
  });

  it("changes nothing within bounds, on a fix's numbered screens too", () => {
    const answer = {
      screens: [
        {
          image: { alt: "A sensor.", prompt: "A sensor." },
          kind: "hookGuess",
          options: [option("A", true), option("B", false)],
          screen: 2,
        },
      ],
      summary: null,
    };

    expect(fitWrittenBounds(answer)).toStrictEqual(answer);
  });
});

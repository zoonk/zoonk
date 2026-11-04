import { describe, expect, it } from "vitest";
import { type Rgba } from "./color.mts";
import { resolveColor } from "./palette.mts";
import { readPalette } from "./read-palette.mts";

const WCAG = {
  blueWeight: 0.0722,
  flare: 0.05,
  gamma: 2.4,
  gammaOffset: 0.055,
  gammaScale: 1.055,
  greenWeight: 0.7152,
  linearScale: 12.92,
  linearThreshold: 0.04045,
  redWeight: 0.2126,
};

const MINIMUM_TEXT_CONTRAST = 4.5;

function linear(channel: number): number {
  return channel <= WCAG.linearThreshold
    ? channel / WCAG.linearScale
    : ((channel + WCAG.gammaOffset) / WCAG.gammaScale) ** WCAG.gamma;
}

function luminance(color: Rgba): number {
  return (
    WCAG.redWeight * linear(color.red) +
    WCAG.greenWeight * linear(color.green) +
    WCAG.blueWeight * linear(color.blue)
  );
}

function contrastRatio({ background, foreground }: { background: Rgba; foreground: Rgba }): number {
  const first = luminance(foreground);
  const second = luminance(background);

  return (Math.max(first, second) + WCAG.flare) / (Math.min(first, second) + WCAG.flare);
}

const { palette, tokens } = readPalette();
const textRoles = ["foreground", "muted-foreground", "faint"];
const surfaces = ["background", "card", "muted"];

const pairs = Object.entries(tokens).flatMap(([mode, values]) =>
  textRoles.flatMap((text) =>
    surfaces.map((surface) => ({
      mode,
      ratio: contrastRatio({
        background: resolveColor({ name: surface, palette, tokens: values }),
        foreground: resolveColor({ name: text, palette, tokens: values }),
      }),
      surface,
      text,
    })),
  ),
);

describe("neutral text accessibility", () => {
  it.each(pairs)("$mode: $text on $surface meets WCAG AA", ({ ratio }) => {
    expect(ratio).toBeGreaterThanOrEqual(MINIMUM_TEXT_CONTRAST);
  });
});

import { describe, expect, it } from "vitest";
import { type Rgba } from "./color.mts";
import { resolveColor } from "./palette.mts";
import { readPalette } from "./read-palette.mts";
import { subjectPalette } from "./subject-palette.mts";

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
const MINIMUM_MORE_CONTRAST = 7;

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

const { palette, subjects, tokens } = readPalette();
const textRoles = ["foreground", "muted-foreground", "faint"];
const surfaces = ["background", "card", "muted"];
const moreContrastModes = ["lightMoreContrast", "darkMoreContrast"] as const;

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

const coloredPairs = moreContrastModes.flatMap((mode) => {
  const lookup = { palette, tokens: tokens[mode] };

  const words = [
    ...[...lookup.tokens.keys()]
      .filter((name) => name.endsWith("-text"))
      .map((name) => [name, resolveColor({ ...lookup, name })] as const),
    ...[...subjects].flatMap(([name, modes]) =>
      [...subjectPalette({ ...lookup, subject: modes[mode] })]
        .filter(([role]) => role.endsWith("-text"))
        .map(([role, color]) => [role.replace("subject", `subject-${name}`), color] as const),
    ),
  ];

  return words.flatMap(([text, foreground]) =>
    surfaces.map((surface) => ({
      mode,
      ratio: contrastRatio({ background: resolveColor({ ...lookup, name: surface }), foreground }),
      surface,
      text,
    })),
  );
});

describe("colored text accessibility with more contrast", () => {
  it.each(coloredPairs)("$mode: $text on $surface meets WCAG AAA", ({ ratio }) => {
    expect(ratio).toBeGreaterThanOrEqual(MINIMUM_MORE_CONTRAST);
  });
});

import { describe, expect, it } from "vitest";
import { type Rgba, over } from "./color.mts";
import { type Mode, modePalette, resolveColor } from "./palette.mts";
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
const modes: Mode[] = ["light", "dark", "lightMoreContrast", "darkMoreContrast"];
const textRoles = ["foreground", "muted-foreground", "faint"];
const surfaces = ["background", "card", "muted"];

/** Colored words are AA in the regular theme and AAA when more contrast is asked for. */
function coloredMinimum(mode: Mode): number {
  return mode.endsWith("MoreContrast") ? MINIMUM_MORE_CONTRAST : MINIMUM_TEXT_CONTRAST;
}

/** Every role as the apps get it, subjects' as `subject-<name>-text` and `subject-<name>-tint`. */
function modeColors(mode: Mode): Map<string, Rgba> {
  const lookup = { palette, tokens: tokens[mode] };
  const colors = modePalette(lookup);

  for (const [name, subjectModes] of subjects) {
    for (const [role, color] of subjectPalette({ ...lookup, subject: subjectModes[mode] })) {
      colors.set(role.replace("subject", `subject-${name}`), color);
    }
  }

  return colors;
}

function pick(colors: Map<string, Rgba>, name: string): Rgba {
  const color = colors.get(name);

  if (!color) {
    throw new Error(`No ${name} role`);
  }

  return color;
}

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

// Words in a color sit on the neutral surfaces and on their own color's tint (a checked answer's
// "Correct", a subject's label), laid on the page as the apps draw it.
const coloredPairs = modes.flatMap((mode) => {
  const colors = modeColors(mode);

  return [...colors.keys()]
    .filter((name) => name.endsWith("-text"))
    .flatMap((text) => {
      const tint = text.replace(/-text$/u, "-tint");
      const grounds = colors.has(tint) ? [...surfaces, tint] : surfaces;

      return grounds.map((ground) => ({
        ground,
        minimum: coloredMinimum(mode),
        mode,
        ratio: contrastRatio({ background: pick(colors, ground), foreground: pick(colors, text) }),
        text,
      }));
    });
});

describe("colored text accessibility", () => {
  it.each(coloredPairs)("$mode: $text on $ground meets $minimum:1", ({ minimum, ratio }) => {
    expect(ratio).toBeGreaterThanOrEqual(minimum);
  });
});

/**
 * The heaviest tint words sit on is a fifth of a color (a destructive button's hover, a SQL result's
 * row, a failing sample). A tint takes one of these colors, never a `-text` role, so a meaning's
 * words stay AA on any of them over any surface, in every mode: across hues and on `muted` too. A
 * subject's name sits only on its own tint, checked above.
 */
const WORD_TINT_SHARE = 0.2;

const TINT_COLORS = [
  "success",
  "destructive",
  "warning",
  "brain",
  "energy",
  "viz-accent",
  "viz-secondary",
  "viz-highlight",
  "kind-review",
  "kind-mock",
  "kind-conversation",
  "kind-mind-map",
];

const tintedPairs = modes.flatMap((mode) => {
  const colors = modeColors(mode);

  return [...colors.keys()]
    .filter((name) => name.endsWith("-text") && !name.startsWith("subject-"))
    .flatMap((text) =>
      surfaces.flatMap((surface) =>
        TINT_COLORS.map((tint) => ({
          mode,
          ratio: contrastRatio({
            background: over(
              { ...pick(colors, tint), alpha: WORD_TINT_SHARE },
              pick(colors, surface),
            ),
            foreground: pick(colors, text),
          }),
          surface,
          text,
          tint,
        })),
      ),
    );
});

describe("colored text on any tint", () => {
  it.each(tintedPairs)(
    "$mode: $text on a fifth of $tint over $surface meets WCAG AA",
    ({ ratio }) => {
      expect(ratio).toBeGreaterThanOrEqual(MINIMUM_TEXT_CONTRAST);
    },
  );
});

/** Fills past that rule, and neutral words on a tint, each as a screen draws it. */
const FILLS: { fill: string; modes?: Mode[]; share: number; text: string; where: string }[] = [
  { fill: "brain-text", share: 1, text: "background", where: "the earned missions reward" },
  {
    fill: "destructive",
    modes: ["dark", "darkMoreContrast"],
    share: 0.3,
    text: "destructive-text",
    where: "a destructive button's hover in dark",
  },
  {
    fill: "success",
    share: 0.1,
    text: "muted-foreground",
    where: "NULL in a SQL result's missing row",
  },
  {
    fill: "destructive",
    share: 0.1,
    text: "muted-foreground",
    where: "NULL in a SQL result's extra row",
  },
];

const filledPairs = modes.flatMap((mode) => {
  const colors = modeColors(mode);

  return FILLS.filter((entry) => !entry.modes || entry.modes.includes(mode)).flatMap(
    ({ fill, share, text, where }) =>
      ["background", "card"].map((surface) => ({
        minimum: coloredMinimum(mode),
        mode,
        ratio: contrastRatio({
          background: over({ ...pick(colors, fill), alpha: share }, pick(colors, surface)),
          foreground: pick(colors, text),
        }),
        surface,
        where,
      })),
  );
});

describe("words on a fill", () => {
  it.each(filledPairs)("$mode: $where over $surface meets $minimum:1", ({ minimum, ratio }) => {
    expect(ratio).toBeGreaterThanOrEqual(minimum);
  });
});

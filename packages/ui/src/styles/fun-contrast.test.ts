// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Reads the Fun palettes straight from fun.css, so the stylesheet stays the only source of the
 * token values, and checks every text and control pair against WCAG AA.
 */

type Rgb = readonly [number, number, number];
type Color = { alpha: number; rgb: Rgb };
type Tokens = Record<string, string>;

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;

const css = readFileSync(new URL("fun.css", import.meta.url), "utf8");

function blockAfter(marker: string): string {
  if (!css.includes(marker)) {
    throw new Error(`Missing block "${marker}" in fun.css`);
  }

  const start = css.indexOf("{", css.indexOf(marker));
  return css.slice(start + 1, css.indexOf("}", start));
}

function parseTokens(block: string): Tokens {
  const matches = block.matchAll(/--fun-(?<name>[\w-]+):\s*(?<value>[^;]+);/gu);

  return Object.fromEntries(
    [...matches].map((match) => [
      match.groups?.name ?? "",
      (match.groups?.value ?? "").replaceAll(/\s+/gu, " ").trim(),
    ]),
  );
}

function parseColor(value: string | undefined): Color {
  const hex = value?.match(/^#(?<hex>[\da-f]{6})$/iu)?.groups?.hex;

  if (hex) {
    const channel = (offset: number) => Number.parseInt(hex.slice(offset, offset + 2), 16);
    return { alpha: 1, rgb: [channel(0), channel(2), channel(4)] };
  }

  const rgb = value?.match(
    /^rgb\((?<red>\d+) (?<green>\d+) (?<blue>\d+)(?: \/ (?<alpha>[\d.]+))?\)$/u,
  )?.groups;

  if (rgb) {
    return {
      alpha: Number(rgb.alpha ?? 1),
      rgb: [Number(rgb.red), Number(rgb.green), Number(rgb.blue)],
    };
  }

  throw new Error(`Unsupported color "${value}"`);
}

function composite(color: Color, background: Rgb): Rgb {
  const mix = (channel: number, index: number) =>
    color.alpha * channel + (1 - color.alpha) * (background[index] ?? 0);

  return [mix(color.rgb[0], 0), mix(color.rgb[1], 1), mix(color.rgb[2], 2)];
}

function linear(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance([red, green, blue]: Rgb): number {
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

function contrast(foreground: Rgb, background: Rgb): number {
  const [light, dark] = [luminance(foreground), luminance(background)].toSorted((a, b) => b - a);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

/** Contrast of a possibly translucent token painted over an opaque background. */
function tokenContrast(foreground: string | undefined, background: Rgb): number {
  return contrast(composite(parseColor(foreground), background), background);
}

function opaque(value: string | undefined): Rgb {
  return parseColor(value).rgb;
}

const shared = parseTokens(blockAfter("Values shared by the canvas and the paper."));
const deepSpace = parseTokens(blockAfter("palette: deep space"));
const paper = parseTokens(blockAfter("palette: paper"));
const cardText = parseTokens(blockAfter("palette: card text"));

const TEXT_TOKENS = ["fg", "fg2", "fg3"];

const ACCENT_TOKENS = ["lime", "cyan", "pink", "orange", "amber", "violet"].map(
  (accent) => `accent-${accent}`,
);

const TONES = [
  "indigo",
  "violet",
  "blue",
  "cyan",
  "teal",
  "emerald",
  "amber",
  "orange",
  "pink",
  "magenta",
];

describe(contrast, () => {
  it("matches the WCAG reference values", () => {
    expect(contrast([0, 0, 0], [255, 255, 255])).toBeCloseTo(21);
    expect(contrast([118, 118, 118], [255, 255, 255])).toBeCloseTo(4.54, 2);
    expect(contrast([12, 10, 34], [12, 10, 34])).toBe(1);
  });

  it("composites translucent colors over their background", () => {
    expect(composite(parseColor("rgb(255 255 255 / 0.5)"), [0, 0, 0])).toStrictEqual([
      127.5, 127.5, 127.5,
    ]);
  });
});

describe("Fun deep space palette (the canvas, on every device)", () => {
  it("doesn't depend on the device's theme, since Fun is dark only", () => {
    expect(css).not.toContain("prefers-color-scheme");
  });

  const canvas = opaque(deepSpace.canvas);
  const nebula = opaque(deepSpace.nebula);
  const glass = composite(parseColor(deepSpace["glass-bg"]), canvas);
  const glassOnNebula = composite(parseColor(deepSpace["glass-bg"]), nebula);

  it.each([...TEXT_TOKENS, ...ACCENT_TOKENS])("%s passes AA on the canvas and on glass", (key) => {
    expect(tokenContrast(deepSpace[key], canvas)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(tokenContrast(deepSpace[key], glass)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each(["fg", "fg2"])("%s passes AA at the nebula's brightest stop", (key) => {
    expect(tokenContrast(deepSpace[key], nebula)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(tokenContrast(deepSpace[key], glassOnNebula)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each(TEXT_TOKENS)("%s passes AA on opaque surfaces", (key) => {
    expect(tokenContrast(deepSpace[key], opaque(deepSpace.surface))).toBeGreaterThanOrEqual(
      AA_TEXT,
    );
  });

  it("keeps the inverse pill readable", () => {
    expect(tokenContrast(deepSpace["inv-fg"], opaque(deepSpace["inv-bg"]))).toBeGreaterThanOrEqual(
      AA_TEXT,
    );
  });

  it("keeps the focus ring visible against the canvas", () => {
    expect(tokenContrast(deepSpace.ring, canvas)).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });

  it("keeps the focus ring visible on a menu's surface and its highlighted item", () => {
    const surface = opaque(deepSpace.surface);
    const highlighted = composite(parseColor(deepSpace.soft), surface);

    expect(tokenContrast(deepSpace.ring, surface)).toBeGreaterThanOrEqual(AA_NON_TEXT);
    expect(tokenContrast(deepSpace.ring, highlighted)).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });
});

describe("Fun paper palette (the light reading surface)", () => {
  const sheet = opaque(shared.paper);

  it.each([...TEXT_TOKENS, ...ACCENT_TOKENS])("%s passes AA on the paper panel", (key) => {
    expect(tokenContrast(paper[key], sheet)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each(TEXT_TOKENS)("%s passes AA on the paper's own surfaces", (key) => {
    expect(tokenContrast(paper[key], opaque(paper.surface))).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("keeps the inverse pill readable", () => {
    expect(tokenContrast(paper["inv-fg"], opaque(paper["inv-bg"]))).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("keeps the focus ring visible on the paper and on a highlighted item", () => {
    const highlighted = composite(parseColor(paper.soft), sheet);

    expect(tokenContrast(paper.ring, sheet)).toBeGreaterThanOrEqual(AA_NON_TEXT);
    expect(tokenContrast(paper.ring, highlighted)).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });
});

describe("Fun surfaces shared by the canvas and the paper", () => {
  it("keeps lime button text readable", () => {
    expect(tokenContrast(shared["lime-foreground"], opaque(shared.lime))).toBeGreaterThanOrEqual(
      AA_TEXT,
    );
  });

  it.each(TONES)("card text passes AA on both %s stops", (tone) => {
    const stops = [shared[`tone-${tone}`], shared[`tone-${tone}-deep`]].map((stop) => opaque(stop));

    for (const stop of stops) {
      for (const key of TEXT_TOKENS) {
        expect(tokenContrast(cardText[key], stop)).toBeGreaterThanOrEqual(AA_TEXT);
      }
    }
  });
});

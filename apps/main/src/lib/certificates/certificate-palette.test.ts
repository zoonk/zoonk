import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CERTIFICATE_COLORS, SUBJECT_COLORS } from "./certificate-palette";

const GLOBALS_CSS = readFileSync(
  join(import.meta.dirname, "../../../../../packages/ui/src/styles/globals.css"),
  "utf8",
);

/** Light-theme tokens are the first declaration of each name in globals.css. */
function readToken(name: string): [number, number, number] {
  const match = new RegExp(`--${name}: oklch\\(([\\d.]+) ([\\d.]+) ([\\d.]+)\\);`, "u").exec(
    GLOBALS_CSS,
  );

  if (!match) {
    throw new Error(`No --${name} in globals.css`);
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function toLinear(channel: number): number {
  const clamped = Math.min(1, Math.max(0, channel));
  return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
}

/** CSS Color 4's OKLCH to sRGB, rounded to 8 bits. */
function oklchToRgb([lightness, chroma, hue]: [number, number, number]): number[] {
  const a = chroma * Math.cos((hue * Math.PI) / 180);
  const b = chroma * Math.sin((hue * Math.PI) / 180);
  const long = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const medium = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const short = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
    -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
    -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short,
  ].map((channel) => Math.round(toLinear(channel) * 255));
}

function hexToRgb(hex: string): number[] {
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
}

function rgbaToRgb(rgba: string): number[] {
  return rgba.match(/\d+/gu)?.slice(0, 3).map(Number) ?? [];
}

describe("certificate palette", () => {
  it("matches the light theme's tokens", () => {
    const tokens = {
      faint: "faint",
      ground: "ground",
      ink: "foreground",
      muted: "muted-foreground",
      success: "success",
      successText: "success-text",
      track: "surface-3",
    } as const;

    const keys = Object.keys(tokens) as (keyof typeof tokens)[];

    expect(
      Object.fromEntries(keys.map((key) => [key, hexToRgb(CERTIFICATE_COLORS[key])])),
    ).toStrictEqual(
      Object.fromEntries(keys.map((key) => [key, oklchToRgb(readToken(tokens[key]))])),
    );
  });

  it("matches each subject's hue and chroma", () => {
    const subjects = [
      ...GLOBALS_CSS.matchAll(
        /\[data-subject="(?<subject>\w+)"\] \{\s*--subject-hue: (?<hue>[\d.]+);\s*--subject-chroma: (?<chroma>[\d.]+);/gu,
      ),
    ]
      .map((match) => ({
        chroma: Number(match.groups?.chroma),
        hue: Number(match.groups?.hue),
        subject: match.groups?.subject ?? "",
      }))
      .filter(({ subject }) => subject !== "general");

    const actual = Object.fromEntries(
      subjects.map(({ subject }) => {
        const colors = SUBJECT_COLORS[subject as keyof typeof SUBJECT_COLORS];
        return [subject, { text: hexToRgb(colors.text), tint: rgbaToRgb(colors.tint) }];
      }),
    );

    const expected = Object.fromEntries(
      subjects.map(({ chroma, hue, subject }) => [
        subject,
        {
          text: oklchToRgb([0.47, 0.1 * chroma, hue]),
          tint: oklchToRgb([0.68, 0.12 * chroma, hue]),
        },
      ]),
    );

    expect(actual).toStrictEqual(expected);
  });
});

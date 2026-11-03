import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { type ImageResponse } from "next/og";

type SatoriFont = NonNullable<
  NonNullable<ConstructorParameters<typeof ImageResponse>[1]>["fonts"]
>[number];

type FontFile = Pick<SatoriFont, "name" | "weight"> & { file: string };

const FONTS_DIR = join(process.cwd(), "src/lib/certificates/fonts");

/*
 * Satori takes no variable fonts, so each weight the design uses is its own instance, named in
 * hundreds: the 560, 620 and 640 instances answer for 600, 700 and 800. These copies carry no
 * kerning: the Satori inside `next/og` leaves a wide gap after every word it kerns
 * (https://github.com/vercel/next.js/issues/101100).
 */
const LATIN_FONTS: FontFile[] = [
  { file: "Geist-400.ttf", name: "Geist", weight: 400 },
  { file: "Geist-500.ttf", name: "Geist", weight: 500 },
  { file: "Geist-560.ttf", name: "Geist", weight: 600 },
  { file: "Geist-620.ttf", name: "Geist", weight: 700 },
  { file: "Geist-640.ttf", name: "Geist", weight: 800 },
  { file: "GeistMono-400.ttf", name: "Geist Mono", weight: 400 },
  { file: "GeistMono-500.ttf", name: "Geist Mono", weight: 500 },
  { file: "GeistMono-600.ttf", name: "Geist Mono", weight: 600 },
  { file: "NotoSans-400.ttf", name: "Noto Sans", weight: 400 },
];

/** A certificate's own words in Japanese or Korean, which Geist doesn't draw. */
const LOCALE_FONTS: Record<string, FontFile[]> = {
  ja: [{ file: "NotoSansJP-400.ttf", name: "Noto Sans JP", weight: 400 }],
  ko: [{ file: "NotoSansKR-400.ttf", name: "Noto Sans KR", weight: 400 }],
};

/** Satori's weights for the design's: kind and chips 560, readouts 620, the brand 640. */
export const FONT_WEIGHTS = { brand: 800, kind: 600, readout: 700 } as const;

async function loadFont({ file, ...font }: FontFile): Promise<SatoriFont> {
  return { ...font, data: await readFile(join(FONTS_DIR, file)), style: "normal" };
}

const fontsByLocale = new Map<string, Promise<SatoriFont[]>>();

/** The same array each time, so Satori parses each font once per instance. */
export function getCertificateFonts(locale: string): Promise<SatoriFont[]> {
  const cached = fontsByLocale.get(locale);

  if (cached) {
    return cached;
  }

  const fonts = Promise.all(
    [...LATIN_FONTS, ...(LOCALE_FONTS[locale] ?? [])].map((font) => loadFont(font)),
  );

  fontsByLocale.set(locale, fonts);
  fonts.catch(() => fontsByLocale.delete(locale));
  return fonts;
}

import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getContentLocale } from "@zoonk/utils/locale";

type FontWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

type SatoriFont = { data: Buffer; name: string; style: "normal"; weight: FontWeight };

const FONTS_DIR = join(process.cwd(), "src/lib/certificates/fonts");

/*
 * Satori takes no variable fonts, so each weight the design uses is its own instance, named in
 * hundreds: the 560, 620 and 640 instances answer for 600, 700 and 800. These copies carry no
 * kerning, since Satori leaves a wide gap after every word it kerns.
 */
const LATIN_FONTS: { file: string; name: string; weight: FontWeight }[] = [
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

const LOCALE_FONTS: Record<string, { file: string; name: string }> = {
  ja: { file: "NotoSansJP-400.ttf", name: "Noto Sans JP" },
  ko: { file: "NotoSansKR-400.ttf", name: "Noto Sans KR" },
};

/** Satori's weights for the design's: kind and chips 560, readouts 620, the brand 640. */
export const FONT_WEIGHTS = { brand: 800, kind: 600, readout: 700 } as const;

async function loadFont(font: { file: string; name: string; weight: FontWeight }) {
  return {
    data: await readFile(join(FONTS_DIR, font.file)),
    name: font.name,
    style: "normal" as const,
    weight: font.weight,
  };
}

const fontsByLocale = new Map<string, Promise<SatoriFont[]>>();

/** The same array each time, so Satori parses each font once per instance. */
export function getCertificateFonts(language: string): Promise<SatoriFont[]> {
  const locale = getContentLocale(language) ?? "";
  const localeFont = LOCALE_FONTS[locale];
  const cached = fontsByLocale.get(locale);

  if (cached) {
    return cached;
  }

  const fonts = Promise.all(
    [...LATIN_FONTS, ...(localeFont ? [{ ...localeFont, weight: 400 as const }] : [])].map((font) =>
      loadFont(font),
    ),
  );

  fontsByLocale.set(locale, fonts);
  return fonts;
}

import "server-only";
import { join } from "node:path";
import sharp from "sharp";

const SHAPING_FONTS_DIR = join(process.cwd(), "src/lib/certificates/fonts/shaping");

/*
 * Pango finds fonts only through fontconfig, which reads where they are from the environment the
 * first time text is drawn: Vercel's runtime has no system fonts, and on macOS Pango would use
 * CoreText and the machine's fonts instead.
 */
process.env.FONTCONFIG_FILE = join(SHAPING_FONTS_DIR, "fonts.conf");
process.env.PANGOCAIRO_BACKEND = "fc";

/*
 * libvips crops text to its ink, so a name without ascenders would come back shorter than one with
 * them. ZoonkStrut.ttf's only glyph is drawn transparent at the start and the end: it inks 1.5 em
 * above the baseline and 0.6 em below, more than any script, which puts the picture's top and
 * bottom at known distances from the first and last baselines. Its code point is bidi-neutral so it
 * doesn't turn an Arabic name's paragraph left-to-right, and its metrics are Geist's so it doesn't
 * change the line height.
 */
const STRUT = '<span font_family="Zoonk Strut" alpha="1">│</span>';
const STRUT_ABOVE = 1.5;
const STRUT_BELOW = 0.6;

/** Geist's ascender and descender, which place a CSS line box's baseline. */
const ASCENT = 1.005;
const DESCENT = 0.295;

const ELLIPSIS = "…";

/** Longer than any real name or title; see `normalizeRuns`. */
const MAX_GRAPHEMES = 200;

/** How close to the narrowest width balancing gets, as a share of the box. */
const BALANCE_PRECISION = 0.01;

export type TextRun = { color: string; text: string };

export type TextBox = {
  lang: string;
  letterSpacing: number;
  lineHeight: number;
  maxLines: number;
  weight: number;
  width: number;
};

export type ShapedText = {
  blockHeight: number;
  height: number;
  lines: number;
  size: number;
  src: string;
  top: number;
  width: number;
};

const PANGO_ESCAPES: Record<string, string> = {
  '"': "&quot;",
  "&": "&amp;",
  "'": "&apos;",
  "<": "&lt;",
  ">": "&gt;",
};

function escapeMarkup(text: string): string {
  return text.replaceAll(/["&'<>]/gu, (char) => PANGO_ESCAPES[char] ?? char);
}

function toPangoUnits(points: number): number {
  return Math.round(points * 1024);
}

function getMarkup({ box, runs, size }: { box: TextBox; runs: readonly TextRun[]; size: number }) {
  const text = runs
    .map((run) => `<span foreground="${run.color}">${escapeMarkup(run.text)}</span>`)
    .join("");

  return [
    `<span line_height="${toPangoUnits(box.lineHeight * size)}" lang="${box.lang}">`,
    STRUT,
    `<span font_weight="${box.weight}" letter_spacing="${toPangoUnits(box.letterSpacing * size)}">`,
    text,
    "</span>",
    STRUT,
    "</span>",
  ].join("");
}

async function drawText({
  box,
  runs,
  size,
}: {
  box: TextBox;
  runs: readonly TextRun[];
  size: number;
}): Promise<ShapedText> {
  const { data, info } = await sharp({
    text: {
      dpi: 72,
      font: `Geist ${size}`,
      rgba: true,
      text: getMarkup({ box, runs, size }),
      width: Math.floor(box.width),
      wrap: "word-char",
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });

  const lineBox = box.lineHeight * size;
  const firstToLastBaseline = info.height - (STRUT_ABOVE + STRUT_BELOW) * size;
  const firstBaseline = lineBox / 2 + ((ASCENT - DESCENT) / 2) * size;

  return {
    blockHeight: firstToLastBaseline + lineBox,
    height: info.height,
    lines: Math.round(firstToLastBaseline / lineBox) + 1,
    size,
    src: `data:image/png;base64,${data.toString("base64")}`,
    top: firstBaseline - STRUT_ABOVE * size,
    width: info.width,
  };
}

function getGraphemes(text: string): string[] {
  return Array.from(
    new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text),
    ({ segment }) => segment,
  );
}

function capText(text: string): string {
  const graphemes = getGraphemes(text);

  return graphemes.length > MAX_GRAPHEMES
    ? `${graphemes.slice(0, MAX_GRAPHEMES).join("").trimEnd()}${ELLIPSIS}`
    : text;
}

/**
 * Whitespace in a profile name (a pasted tab or line break) would break the line where Pango sees
 * it. Profile names have no length limit, and Pango's work grows with the text, so a name past any
 * real one is cut.
 */
function normalizeRuns(runs: readonly TextRun[]): TextRun[] {
  return runs.map((run) => ({ ...run, text: capText(run.text.replaceAll(/\s+/gu, " ")) }));
}

type ShapeInput = {
  box: TextBox;
  fits: (shaped: ShapedText) => boolean;
  runs: readonly TextRun[];
  sizes: readonly number[];
};

async function searchSizes({
  fallback,
  high,
  low,
  ...input
}: ShapeInput & { fallback: ShapedText | null; high: number; low: number }) {
  if (low > high) {
    return fallback;
  }

  const middle = Math.floor((low + high) / 2);

  const shaped = await drawText({
    box: input.box,
    runs: input.runs,
    size: input.sizes[middle] ?? 0,
  });

  if (input.fits(shaped)) {
    return searchSizes({ ...input, fallback: shaped, high: middle - 1, low });
  }

  return searchSizes({ ...input, fallback, high, low: middle + 1 });
}

async function searchBalance({
  box,
  narrowest,
  runs,
  shaped,
  widest,
}: {
  box: TextBox;
  narrowest: number;
  runs: readonly TextRun[];
  shaped: ShapedText;
  widest: number;
}): Promise<ShapedText> {
  if (widest - narrowest <= box.width * BALANCE_PRECISION) {
    return shaped;
  }

  const width = Math.floor((narrowest + widest) / 2);
  const narrower = await drawText({ box: { ...box, width }, runs, size: shaped.size });

  if (narrower.lines === shaped.lines) {
    return searchBalance({ box, narrowest, runs, shaped: narrower, widest: width });
  }

  return searchBalance({ box, narrowest: width, runs, shaped, widest });
}

/** Like CSS `text-wrap: balance`: the narrowest box that keeps the line count, so no line is left nearly empty. */
function balanceLines({
  box,
  runs,
  shaped,
}: {
  box: TextBox;
  runs: readonly TextRun[];
  shaped: ShapedText;
}): Promise<ShapedText> {
  if (shaped.lines < 2) {
    return Promise.resolve(shaped);
  }

  return searchBalance({
    box,
    narrowest: box.width / shaped.lines,
    runs,
    shaped,
    widest: box.width,
  });
}

/**
 * Draws the runs at the largest of `sizes` (largest first) that fits `box.maxLines` lines and
 * passes `fits`, so a short name never grows past the first size. When none does, it's drawn at the
 * smallest.
 */
export async function shapeText({
  box,
  fits = () => true,
  runs,
  sizes,
}: Omit<ShapeInput, "fits"> & { fits?: ShapeInput["fits"] }): Promise<ShapedText> {
  const normalized = normalizeRuns(runs);

  const fitted = await searchSizes({
    box,
    fallback: null,
    fits: (shaped) => shaped.lines <= box.maxLines && fits(shaped),
    high: sizes.length - 1,
    low: 0,
    runs: normalized,
    sizes,
  });

  const shaped = fitted ?? (await drawText({ box, runs: normalized, size: sizes.at(-1) ?? 0 }));

  return balanceLines({ box, runs: normalized, shaped });
}

async function searchTruncation({
  box,
  fallback,
  graphemes,
  high,
  low,
  run,
  size,
}: {
  box: TextBox;
  fallback: ShapedText;
  graphemes: readonly string[];
  high: number;
  low: number;
  run: TextRun;
  size: number;
}): Promise<ShapedText> {
  if (low > high) {
    return fallback;
  }

  const middle = Math.floor((low + high) / 2);
  const text = `${graphemes.slice(0, middle).join("").trimEnd()}${ELLIPSIS}`;
  const shaped = await drawText({ box, runs: [{ ...run, text }], size });

  if (shaped.lines <= box.maxLines) {
    return searchTruncation({ box, fallback: shaped, graphemes, high, low: middle + 1, run, size });
  }

  return searchTruncation({ box, fallback, graphemes, high: middle - 1, low, run, size });
}

/**
 * Like `shapeText`, but text that doesn't fit at the smallest size ends in an ellipsis instead, in
 * the first run's color.
 */
export async function shapeClampedText({
  box,
  runs,
  sizes,
}: {
  box: TextBox;
  runs: readonly TextRun[];
  sizes: readonly number[];
}): Promise<ShapedText> {
  const shaped = await shapeText({ box, runs, sizes });

  if (shaped.lines <= box.maxLines) {
    return shaped;
  }

  const [first] = runs;
  const run = { color: first?.color ?? "", text: runs.map((part) => part.text).join("") };
  const [normalized = run] = normalizeRuns([run]);
  const graphemes = getGraphemes(normalized.text);
  const ellipsis = await drawText({ box, runs: [{ ...run, text: ELLIPSIS }], size: shaped.size });

  return searchTruncation({
    box,
    fallback: ellipsis,
    graphemes,
    high: graphemes.length - 1,
    low: 1,
    run: normalized,
    size: shaped.size,
  });
}

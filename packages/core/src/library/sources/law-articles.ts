const LINE_START = String.raw`(?:^|[\n\f])[^\S\n\f]*`;
const ORDINAL = String.raw`(?:\.?[º°ª]|o\b|er\b)?`;
const CJK_NUMERALS = "〇零一二三四五六七八九十百千";
const CJK_SUFFIX = String.raw`[の之][\d${CJK_NUMERALS}]+`;
/** "4-A", "4a", "12 bis" and "32の二": one rule for headings and hints, so the two read alike. */
const SUFFIX = String.raw`(?:-?[A-Za-z]{1,2}\b|[^\S\n]*(?:bis|ter|quater)\b|${CJK_SUFFIX})?`;
const DIGITS = String.raw`\d+(?:[.-]\d+)*`;

/**
 * The first family the text uses heads its articles. Brazilian laws open paragraphs with "§", which
 * heads articles only in texts with no article word, such as German statutes and the US Code.
 */
const HEADING_FAMILIES = [
  String.raw`(?:Art\.|Artigo|Artículo|Articulo|Article|Articolo|Artikel)[^\S\n]*(?<number>${DIGITS})${ORDINAL}(?<suffix>${SUFFIX})\.?`,
  String.raw`第(?<number>[\d${CJK_NUMERALS}]+)条(?<suffix>${SUFFIX})`,
  String.raw`(?:Section|SECTION|Sec\.|SEC\.)[^\S\n]*(?<number>${DIGITS})(?<suffix>${SUFFIX})\.?`,
  String.raw`§[^\S\n]*(?<number>${DIGITS})(?<suffix>${SUFFIX})\.?`,
].map((heading) => new RegExp(`${LINE_START}(?<heading>${heading})`, "gu"));

const ARTICLE_NUMBER = new RegExp(
  String.raw`(?<number>${DIGITS}|[${CJK_NUMERALS}]+)条?${ORDINAL}(?<suffix>${SUFFIX})`,
  "u",
);

/** Fewer articles than this aren't a law's text, which then keeps its ordinary pages. */
const MIN_LAW_ARTICLES = 3;

const MAX_PIECE_CHARACTERS = 3000;

export type LawArticleText = {
  body: string;
  /** Starts at 1 and moves on when numbering starts again, as in an appended amendment. */
  documentPart: number;
  heading: string;
  /** "4", "4A", "12BIS": the same for a revoked wording kept beside its new one. */
  number: string;
  text: string;
};

export type LawArticlePiece = {
  documentPart: number;
  /** Unique within its text, except for an article whose wording the text repeats. */
  label: string;
  number: string;
  text: string;
};

type Heading = { end: number; heading: string; number: string; start: number; value: number };

const CJK_DIGITS = "〇一二三四五六七八九";
const CJK_UNITS = "十百千";

function parseCjkNumber(numeral: string): number {
  const { digit, total } = (numeral.replaceAll("零", "〇").match(/./gu) ?? []).reduce(
    (sum, character) => {
      const unit = CJK_UNITS.indexOf(character);

      return unit === -1
        ? { digit: Math.max(CJK_DIGITS.indexOf(character), 0), total: sum.total }
        : { digit: 0, total: sum.total + (sum.digit || 1) * 10 ** (unit + 1) };
    },
    { digit: 0, total: 0 },
  );

  return total + digit;
}

/** "-a", " bis" and "之二" are written "A", "BIS" and "の2", however a heading or hint spells them. */
function toSuffix(suffix: string): string {
  const cjk = /^[の之](?<numeral>.+)$/u.exec(suffix)?.groups?.numeral;

  if (cjk) {
    return `の${/^\d+$/u.test(cjk) ? Number(cjk) : parseCjkNumber(cjk)}`;
  }

  return suffix.replaceAll(/[\s-]+/gu, "").toUpperCase();
}

/**
 * "107.51" is section 51 of part 107 and "515-14" an article inserted after 515: each keeps its
 * whole number, and numbering goes on within the part.
 */
function toNumber(groups: Record<string, string | undefined>): { number: string; value: number } {
  const numeral = groups.number ?? "";
  const isDigits = /^\d/u.test(numeral);
  const value = isDigits ? Number(numeral.split(/[.-]/u)[0]) : parseCjkNumber(numeral);
  const number = isDigits ? numeral.replaceAll(/\d+/gu, (part) => String(Number(part))) : value;

  return { number: `${number}${toSuffix(groups.suffix ?? "")}`, value };
}

function toHeading(match: RegExpMatchArray): Heading {
  const groups = match.groups ?? {};
  const raw = groups.heading ?? "";
  const start = (match.index ?? 0) + match[0].length - raw.length;

  return {
    ...toNumber(groups),
    end: start + raw.length,
    heading: raw.replaceAll(/\s+/gu, " ").replace(/\.$/u, "").trim(),
    start,
  };
}

function findHeadings(text: string): Heading[] {
  const family = HEADING_FAMILIES.find((pattern) => text.search(pattern) !== -1);
  return family ? [...text.matchAll(family)].map((match) => toHeading(match)) : [];
}

function toDocumentParts(headings: readonly Heading[]): number[] {
  return headings.reduce<number[]>((parts, heading, index) => {
    const previous = headings[index - 1];
    const part = parts.at(-1) ?? 1;

    parts.push(previous && heading.value < previous.value ? part + 1 : part);
    return parts;
  }, []);
}

/** Every article of the text, whole and in order; empty when it has no article headings. */
export function splitLawArticles(text: string): LawArticleText[] {
  const headings = findHeadings(text);
  const parts = toDocumentParts(headings);

  return headings.map((heading, index) => {
    const end = headings[index + 1]?.start ?? text.length;

    return {
      body: text.slice(heading.end, end).trim(),
      documentPart: parts[index] ?? 1,
      heading: heading.heading,
      number: heading.number,
      text: text.slice(heading.start, end).trim(),
    };
  });
}

function toLines(text: string): string[] {
  return text
    .split(/[\n\f]/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** A piece takes whole lines, so a paragraph is never cut; a line longer than a piece stays whole. */
function toPieces(lines: readonly string[]): string[][] {
  return lines.reduce<string[][]>((pieces, line) => {
    const last = pieces.at(-1);

    if (last && last.join("\n").length + line.length < MAX_PIECE_CHARACTERS) {
      last.push(line);
    } else {
      pieces.push([line]);
    }

    return pieces;
  }, []);
}

function toLabel(article: LawArticleText): string {
  return article.documentPart > 1
    ? `Text ${article.documentPart}, ${article.heading}`
    : article.heading;
}

function toArticlePieces(article: LawArticleText): LawArticlePiece[] {
  const label = toLabel(article);
  const [first = [], ...rest] = toPieces(toLines(article.text));

  return [first, ...rest.map((lines) => [article.heading, ...lines])].map((lines, index) => ({
    documentPart: article.documentPart,
    label: index === 0 ? label : `${label}, part ${index + 1}`,
    number: article.number,
    text: lines.join("\n"),
  }));
}

/** Long articles split into pieces that repeat their heading. Null when the text isn't articles. */
export function splitLawArticlePieces(text: string): LawArticlePiece[] | null {
  const articles = splitLawArticles(text);

  return articles.length < MIN_LAW_ARTICLES
    ? null
    : articles.flatMap((article) => toArticlePieces(article));
}

/** "Art. 4º, § 2º", "art. 4" and "第四条" name article "4"; "4º-A" and "4A" name "4A". */
export function toArticleNumber(hint: string): string | null {
  const groups = ARTICLE_NUMBER.exec(hint)?.groups;
  return groups ? toNumber(groups).number : null;
}

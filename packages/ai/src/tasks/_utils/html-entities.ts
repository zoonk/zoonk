/** HTML names an accent after the letter it marks ("acirc" is "â"); these are the marks. */
const ACCENT_MARKS: Readonly<Record<string, string>> = {
  acute: "́",
  cedil: "̧",
  circ: "̂",
  grave: "̀",
  ring: "̊",
  tilde: "̃",
  uml: "̈",
};

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  apos: "'",
  deg: "°",
  gt: ">",
  hellip: "…",
  laquo: "«",
  ldquo: "“",
  lsquo: "‘",
  lt: "<",
  mdash: "—",
  middot: "·",
  nbsp: " ",
  ndash: "–",
  ordf: "ª",
  ordm: "º",
  quot: '"',
  raquo: "»",
  rdquo: "”",
  rsquo: "’",
};

const ENTITY = /&(?:#\d{1,7}|#x[\da-f]{1,6}|[a-z]{2,8});/giu;
const ENTITY_PARTS = /^&(?:#(?<decimal>\d+)|#x(?<hex>[\da-f]+)|(?<name>[a-z]+));$/iu;
const ACCENTED_LETTER = /^(?<letter>[a-z])(?<accent>acute|cedil|circ|grave|ring|tilde|uml)$/iu;
const MAX_CODE_POINT = 1_114_111;
const HEX = 16;

function fromCodePoint(codePoint: number): string | null {
  return codePoint > 0 && codePoint <= MAX_CODE_POINT ? String.fromCodePoint(codePoint) : null;
}

function toAccentedLetter(name: string): string | null {
  const { accent, letter } = ACCENTED_LETTER.exec(name)?.groups ?? {};
  const mark = accent ? ACCENT_MARKS[accent] : undefined;

  if (!letter || !mark) {
    return null;
  }

  const composed = `${letter}${mark}`.normalize("NFC");
  return composed.length === 1 ? composed : null;
}

function decodeEntity({
  decimal,
  hex,
  name,
}: {
  decimal?: string;
  hex?: string;
  name?: string;
}): string | null {
  if (decimal) {
    return fromCodePoint(Number(decimal));
  }

  if (hex) {
    return fromCodePoint(Number.parseInt(hex, HEX));
  }

  return name ? (NAMED_ENTITIES[name] ?? toAccentedLetter(name)) : null;
}

/** Some models escape letters as HTML entities in plain text ("l&acirc;mpada"). */
export function decodeHtmlEntities(text: string): string {
  return text.replaceAll(
    ENTITY,
    (entity) => decodeEntity(ENTITY_PARTS.exec(entity)?.groups ?? {}) ?? entity,
  );
}

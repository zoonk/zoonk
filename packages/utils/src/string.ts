const SLUG_MAX_LENGTH = 50;
const WORD_CONNECTOR_PATTERN = /^[-'’‐‑‒–]$/u;
const wordSegmenter = new Intl.Segmenter(undefined, { granularity: "word" });

export function removeAccents(str: string): string {
  return str.normalize("NFD").replaceAll(/[\u0300-\u036F]/gu, "");
}

export function normalizeString(str: string): string {
  return removeAccents(str).toLowerCase().replaceAll(/\s+/gu, " ").trim();
}

export function toSlug(str: string): string {
  return removeAccents(str.trim())
    .normalize("NFC")
    .replaceAll(/(?<prefix>^|\s)\.(?=\p{L})/gu, "$<prefix>dot ")
    .replaceAll("+", " plus ")
    .replaceAll(/(?<=[\p{L}\p{N}])#/gu, " sharp ")
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}\p{M}\s-]/gu, "")
    .replaceAll(/\s+/gu, "-")
    .replaceAll(/-+/gu, "-")
    .slice(0, SLUG_MAX_LENGTH)
    .replaceAll(/^-|-$/gu, "");
}

export function deduplicateNormalizedTexts(texts: string[]): string[] {
  return [
    ...new Map(
      texts.flatMap((text) => {
        const normalizedText = normalizePunctuation(text).trim();

        return normalizedText ? [[normalizeString(normalizedText), normalizedText]] : [];
      }),
    ).values(),
  ];
}

export function ensureLocaleSuffix(value: string, language: string): string {
  if (language === "en") {
    return value;
  }

  const suffix = `-${language}`;

  if (value.endsWith(suffix)) {
    return value;
  }

  return `${value}${suffix}`;
}

export function normalizePunctuation(text: string): string {
  return text.replaceAll(/(?<!\s)\s+(?<punctuation>[!?.,;:!?。、！？؟])/gu, "$<punctuation>");
}

/**
 * The app never shows em dashes: one that opens a line or closes a clause before punctuation goes,
 * any other becomes a comma. En dashes stay: they join ranges ("B1–B2").
 */
export function replaceEmDashes(text: string): string {
  if (!text.includes("—")) {
    return text;
  }

  return text
    .replaceAll(/^[ \t]*—[ \t]*/gmu, "")
    .replaceAll(/[ \t]*—[ \t]*(?=[,.;:!?)]|$)/gmu, "")
    .replaceAll(/[ \t]*—[ \t]*/gu, ", ");
}

const OPEN_DASH_TAIL = /[ \t—]*$/u;

/**
 * `push` holds back a trailing dash and its spaces until the next piece says what follows. Joined,
 * the returned pieces read as `replaceEmDashes` reads the whole text.
 */
export function createEmDashReplacer(): { end: () => string; push: (piece: string) => string } {
  let held = "";
  let atLineStart = true;

  // A piece that continues a line doesn't open one: a mark in front keeps a dash there mid-line.
  const replace = (text: string) => {
    const replaced = atLineStart ? replaceEmDashes(text) : replaceEmDashes(`x${text}`).slice(1);
    atLineStart = text ? text.endsWith("\n") : atLineStart;
    return replaced;
  };

  return {
    end: () => {
      const rest = replace(held);
      held = "";
      return rest;
    },
    push: (piece) => {
      const text = held + piece;
      held = OPEN_DASH_TAIL.exec(text)?.[0] ?? "";
      return replace(text.slice(0, text.length - held.length));
    },
  };
}

export function stripPunctuation(text: string): string {
  return text.replaceAll(/[^\p{L}\p{N}\s]/gu, "");
}

function endsWithConnector(token: string): boolean {
  const lastChar = token.at(-1);
  return lastChar !== undefined && WORD_CONNECTOR_PATTERN.test(lastChar);
}

/** Intl.Segmenter splits connector-linked runs like "gato-123" and "l'heure"; this rejoins them. */
function segmentNonSpaceText(text: string): string[] {
  const tokens: string[] = [];
  let prefix = "";

  for (const segment of wordSegmenter.segment(text)) {
    const lastToken = tokens.at(-1);

    if (segment.isWordLike) {
      if (lastToken !== undefined && endsWithConnector(lastToken)) {
        tokens[tokens.length - 1] += segment.segment;
      } else {
        tokens.push(prefix + segment.segment);
        prefix = "";
      }
    } else if (lastToken === undefined) {
      prefix += segment.segment;
    } else {
      tokens[tokens.length - 1] += segment.segment;
    }
  }

  return tokens;
}

export function segmentWords(text: string): string[] {
  const normalizedText = normalizePunctuation(text);

  if (normalizedText.includes(" ")) {
    return normalizedText.split(" ").filter(Boolean);
  }

  return segmentNonSpaceText(normalizedText);
}

export function getFirstSentence(text: string, locale: string): string {
  const [first] = new Intl.Segmenter(locale, { granularity: "sentence" }).segment(text.trim());

  return first?.segment.trim() ?? "";
}

export function pickAvailableSlug({
  base,
  taken,
}: {
  base: string;
  taken: readonly string[];
}): string {
  const takenSlugs = new Set(taken);

  if (!takenSlugs.has(base)) {
    return base;
  }

  const suffix = Array.from({ length: takenSlugs.size + 1 }, (_, index) => index + 2).find(
    (candidate) => !takenSlugs.has(`${base}-${candidate}`),
  );

  return `${base}-${suffix}`;
}

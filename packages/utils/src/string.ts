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

/**
 * Different parts of the app can send the same text with tiny formatting differences,
 * such as extra spaces, accents, or a space before punctuation.
 * Return one stable copy of each text so we do not compare or save duplicates like
 * "Bonjour !" and "Bonjour!".
 */
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
 * Takes em dashes out of generated copy, which the app never shows: one that opens a line (a
 * dialogue or list mark) or closes a clause before punctuation goes away, any other becomes a
 * comma ("statement of defense — the written defense" reads "statement of defense, the written defense"). En dashes
 * stay: they join ranges ("B1–B2").
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

/** What a dash still waiting for the text after it could change: trailing spaces, tabs and dashes. */
const OPEN_DASH_TAIL = /[ \t—]*$/u;

/**
 * `replaceEmDashes` for text that arrives in pieces, such as a streamed answer: `push` returns a
 * piece's text as soon as nothing after it can change it, holding back a trailing dash and the
 * spaces around it until the next piece says what follows, and `end` returns what's left. Joined,
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

/**
 * Check whether the last character of a token is a word connector
 * (hyphen, apostrophe, or similar). Used to decide if the next
 * word-like segment should merge into the current token.
 */
function endsWithConnector(token: string): boolean {
  const lastChar = token.at(-1);
  return lastChar !== undefined && WORD_CONNECTOR_PATTERN.test(lastChar);
}

/**
 * Intl.Segmenter is good at finding word boundaries in scripts like Japanese or Chinese,
 * but it also splits connector-linked tokens such as "gato-123", "l'heure", or
 * "allez-vous?" into pieces. Rebuild those runs into one token so the player, answer
 * checker, and other consumers keep one shared tokenization rule.
 */
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

/**
 * Segments text into display tokens for word-based lessons. Space-delimited text
 * keeps punctuation attached to the preceding word, while non-space text uses
 * `Intl.Segmenter` and then merges connector-linked runs back together.
 */
export function segmentWords(text: string): string[] {
  const normalizedText = normalizePunctuation(text);

  if (normalizedText.includes(" ")) {
    return normalizedText.split(" ").filter(Boolean);
  }

  return segmentNonSpaceText(normalizedText);
}

/**
 * The first sentence of a text, whole: a summary that never stops mid-thought the way a line clamp
 * does. Sentence breaks follow the text's language (`Intl.Segmenter`), so languages without spaces
 * work too. Text without a sentence end comes back trimmed.
 */
export function getFirstSentence(text: string, locale: string): string {
  const [first] = new Intl.Segmenter(locale, { granularity: "sentence" }).segment(text.trim());

  return first?.segment.trim() ?? "";
}

/** Repeated titles get the first free numbered suffix inside their owner, course or chapter. */
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

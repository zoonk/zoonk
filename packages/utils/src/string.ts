const SLUG_MAX_LENGTH = 50;
const NAME_PLACEHOLDER = "{{NAME}}";
const WORD_CONNECTOR_PATTERN = /^[-'’‐‑‒–]$/u;
const wordSegmenter = new Intl.Segmenter(undefined, { granularity: "word" });

export function removeAccents(str: string): string {
  return str.normalize("NFD").replaceAll(/[\u0300-\u036F]/g, "");
}

export function normalizeString(str: string): string {
  return removeAccents(str).toLowerCase().replaceAll(/\s+/g, " ").trim();
}

export function toSlug(str: string): string {
  return removeAccents(str.trim())
    .normalize("NFC")
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}\p{M}\s-]/gu, "")
    .replaceAll(/\s+/g, "-")
    .replaceAll(/-+/g, "-")
    .slice(0, SLUG_MAX_LENGTH)
    .replaceAll(/^-|-$/g, "");
}

function nextAvailableSlug(base: string, taken: Set<string>): string {
  let counter = 1;

  while (taken.has(`${base}-${counter}`)) {
    counter += 1;
  }

  return `${base}-${counter}`;
}

export function deduplicateSlugs<T extends { slug: string }>(items: T[]): T[] {
  const taken = new Set<string>(items.map((item) => item.slug));
  const seen = new Set<string>();

  return items.map((item) => {
    if (!seen.has(item.slug)) {
      seen.add(item.slug);
      return item;
    }

    const candidate = nextAvailableSlug(item.slug, taken);
    taken.add(candidate);
    return { ...item, slug: candidate };
  });
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

/**
 * Converts optional free-text fields into the database representation for missing text.
 * This keeps blank generated fields from being saved as meaningful strings.
 */
export function emptyToNull(value?: string | null): string | null {
  return value?.trim() || null;
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

export function removeLocaleSuffix(value: string, language: string): string {
  if (language === "en") {
    return value;
  }

  const suffix = `-${language}`;

  return value.endsWith(suffix) ? value.slice(0, -suffix.length) : value;
}

export function normalizePunctuation(text: string): string {
  return text.replaceAll(/(?<!\s)\s+([!?.,;:!?。、！？؟])/g, "$1");
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

export function extractUniqueSentenceWords(sentences: string[]): string[] {
  const words = sentences.flatMap((sentence) =>
    segmentWords(sentence).flatMap((token) => {
      const stripped = stripPunctuation(token).toLowerCase();
      return stripped.length > 0 ? [stripped] : [];
    }),
  );

  return [...new Set(words)];
}

/**
 * Capitalize the first letter of a string without mutating the rest.
 * Needed after stripping a leading `{{NAME}}` placeholder so the
 * remaining sentence still starts with an uppercase letter.
 */
function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Replace `{{NAME}}` placeholders with the user's display name.
 * When the user is unauthenticated (`name` is null), strip the
 * placeholder and any surrounding comma-space punctuation, then
 * capitalize the result so sentences that started with `{{NAME}}`
 * still begin with an uppercase letter.
 */
export function replaceNamePlaceholder(text: string, name: string | null): string {
  if (!text.includes(NAME_PLACEHOLDER)) {
    return text;
  }

  if (name) {
    return text.replaceAll(NAME_PLACEHOLDER, name);
  }

  const stripped = text
    .replaceAll(/\{\{NAME\}\},\s*/g, "")
    .replaceAll(/,\s*\{\{NAME\}\}/g, "")
    .replaceAll(NAME_PLACEHOLDER, "")
    .trim();

  return capitalizeFirst(stripped);
}

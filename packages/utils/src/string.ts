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

/**
 * User text can contain regex operators like "." or "*".
 * Escape them before building a RegExp so phrase matching stays literal.
 */
function escapeRegExp(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/**
 * Short lesson words like "he" or "a" appear inside bigger words all the time.
 * If each caller builds its own regex, the player and the API can disagree about
 * whether a taught phrase is really present. Keep one shared rule here so every
 * part of the app makes the same decision.
 *
 * We also treat one or many spaces as equivalent because user text and AI text
 * often differ only in spacing, such as "Guten Tag" vs "Guten   Tag".
 */
function createWholePhrasePattern(phrase: string): RegExp | null {
  const normalizedPhrase = normalizePunctuation(phrase).trim();

  if (!normalizedPhrase) {
    return null;
  }

  const escapedPhrase = escapeRegExp(normalizedPhrase).replaceAll(" ", String.raw`\s+`);

  return new RegExp(`(^|[^\\p{L}\\p{N}])(?:${escapedPhrase})(?=$|[^\\p{L}\\p{N}])`, "iu");
}

/**
 * Answer checking and sentence-variant generation both need to know whether a
 * lesson phrase appears as its own expression, not as a fragment inside another
 * word. For example, "he" should match "he sleeps" but not "the cat".
 *
 * Use this helper instead of `includes` whenever the meaning is "does this exact
 * taught phrase appear in this text?"
 */
export function hasWholePhrase(text: string, phrase: string): boolean {
  const pattern = createWholePhrasePattern(phrase);

  if (!pattern) {
    return false;
  }

  return pattern.test(normalizePunctuation(text));
}

/**
 * Some activity variants replace one accepted lesson phrase with another phrase
 * that means the same thing. We only want to swap the exact phrase we matched
 * above, otherwise replacing "he" could corrupt a larger word like "the".
 *
 * Returning `null` makes the caller handle "nothing was replaced" explicitly
 * instead of assuming the text changed.
 */
export function replaceWholePhrase(
  text: string,
  search: string,
  replacement: string,
): string | null {
  const pattern = createWholePhrasePattern(search);

  if (!pattern) {
    return null;
  }

  const normalizedText = normalizePunctuation(text);

  if (!pattern.test(normalizedText)) {
    return null;
  }

  return normalizedText.replace(pattern, (_match, prefix: string) => `${prefix}${replacement}`);
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
 * Segments text into display tokens for word-based activities. Space-delimited text
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

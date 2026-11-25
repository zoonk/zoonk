/** What a page's transcript must and must not hold, written as the page shows it. */
export type TranscribeMaterialExpected = {
  /** Words the page holds; the share found is the transcript's recall. */
  terms?: string[];
  /** Signs, numbers and formulas exactly as written: a lost minus or a flipped arrow fails. */
  exact?: string[];
  /** A sign, number or relation the page holds the other way round. */
  flipped?: string[];
  /** What the page doesn't say: a fact added from knowledge, a translation, a solved exercise. */
  invented?: string[];
  /** Phrases that appear in this order: columns read one after the other, a chain kept in its direction. */
  order?: string[];
  /** Nothing on the page to study. */
  empty?: true;
};

export type TranscriptionCheck = {
  recall: number;
  /** Signs, numbers and relations: every exact one present, none flipped, the order kept. */
  signsAndRelations: boolean;
  /** Nothing the page doesn't say. */
  noInvention: boolean;
  /** An empty page came back empty; true on pages with text. */
  emptyWhenNothing: boolean;
  problems: string[];
};

const SUBSCRIPTS = "₀₁₂₃₄₅₆₇₈₉";

/** LaTeX, Unicode and Markdown spell the same marks many ways; compare what they say. */
export function normalizeTranscript(text: string): string {
  return text
    .normalize("NFC")
    .replaceAll(/\\(?:d|t)?frac\{(?<top>[^{}]*)\}\{(?<bottom>[^{}]*)\}/gu, "$<top>/$<bottom>")
    .replaceAll(/\\(?:Delta|triangle|bigtriangleup)|△|∆/gu, "Δ")
    .replaceAll(/\\(?:to|rightarrow|longrightarrow|Rightarrow)|->|⟶|⇒/gu, "→")
    .replaceAll(String.raw`\int`, "∫")
    .replaceAll(String.raw`\pi`, "π")
    .replaceAll(String.raw`\div`, "÷")
    .replaceAll(/\\(?:neq|ne)(?![a-z])/gu, "≠")
    .replaceAll(/\^\{?\\circ\}?|\\degree/gu, "°")
    .replaceAll(/\\(?:left|right|mathrm|text|operatorname|displaystyle|quad|qquad)/gu, "")
    .replaceAll(/\\[,;:! ]/gu, "")
    .replaceAll("{,}", ",")
    .toLowerCase()
    .replaceAll(/[−–—]/gu, "-")
    .replaceAll(/[‘’]/gu, "'")
    .replaceAll(/[₀-₉]/gu, (digit) => String(SUBSCRIPTS.indexOf(digit)))
    .replaceAll("²", "^2")
    .replaceAll(/\*\*|__/gu, "")
    .replaceAll(/[\s$_{}()\\]/gu, "");
}

const ILLEGIBLE = /\[illegible\]/giu;

export function hasNoWords(text: string): boolean {
  return !/[\p{L}\p{N}]/u.test(text.replaceAll(ILLEGIBLE, ""));
}

function isInOrder({ phrases, text }: { phrases: string[]; text: string }): boolean {
  const positions = phrases.map((phrase) => text.indexOf(normalizeTranscript(phrase)));

  return positions.every(
    (position, index) => position >= 0 && position > (positions[index - 1] ?? -1),
  );
}

export function checkTranscription({
  expected,
  text,
}: {
  expected: TranscribeMaterialExpected;
  text: string;
}): TranscriptionCheck {
  const normalized = normalizeTranscript(text);
  const has = (phrase: string) => normalized.includes(normalizeTranscript(phrase));

  const terms = expected.terms ?? [];
  const missingTerms = terms.filter((term) => !has(term));
  const missingExact = (expected.exact ?? []).filter((phrase) => !has(phrase));
  const flipped = (expected.flipped ?? []).filter((phrase) => has(phrase));
  const invented = (expected.invented ?? []).filter((phrase) => has(phrase));
  const orderKept = !expected.order || isInOrder({ phrases: expected.order, text: normalized });
  const emptyWhenNothing = !expected.empty || hasNoWords(text);

  const problems = [
    missingTerms.length > 0 ? `Missing words: ${missingTerms.join(", ")}.` : "",
    missingExact.length > 0 ? `Missing or changed: ${missingExact.join(", ")}.` : "",
    flipped.length > 0 ? `Flipped: ${flipped.join(", ")}.` : "",
    orderKept ? "" : `Out of order: ${expected.order?.join(" → ")}.`,
    invented.length > 0 ? `Not on the page: ${invented.join(", ")}.` : "",
    emptyWhenNothing ? "" : "Wrote text for a page with nothing to study.",
  ].filter(Boolean);

  return {
    emptyWhenNothing,
    noInvention: invented.length === 0,
    problems,
    recall: terms.length === 0 ? 1 : (terms.length - missingTerms.length) / terms.length,
    signsAndRelations: missingExact.length === 0 && flipped.length === 0 && orderKept,
  };
}

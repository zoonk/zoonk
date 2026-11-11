const ENGLISH_CONTRACTIONS: readonly [RegExp, string][] = [
  [/\bcan't\b/gu, "can not"],
  [/\bwon't\b/gu, "will not"],
  [/n't\b/gu, " not"],
  [/'re\b/gu, " are"],
  [/'ve\b/gu, " have"],
  [/'m\b/gu, " am"],
  [/'ll\b/gu, " will"],
];

/** Their long form depends on the sentence: "what's" is "what is" or "what has". */
const ENGLISH_AMBIGUOUS_CONTRACTIONS: readonly [string, readonly string[]][] = [
  ["'s", ["is", "has"]],
  ["'d", ["would", "had"]],
];

function isEnglish(language: string): boolean {
  return language.startsWith("en");
}

export function expandContractions({ language, text }: { language: string; text: string }): string {
  if (!isEnglish(language)) {
    return text;
  }

  return ENGLISH_CONTRACTIONS.reduce(
    (expanded, [pattern, replacement]) => expanded.replaceAll(pattern, replacement),
    text,
  );
}

function hasPair(tokens: readonly string[], first: string, second: string): boolean {
  return tokens.some((token, index) => token === first && tokens[index + 1] === second);
}

type Texts = readonly (readonly string[])[];

function toLongForm({ texts, token }: { texts: Texts; token: string }): string[] {
  const longForms = ENGLISH_AMBIGUOUS_CONTRACTIONS.flatMap(([suffix, forms]) => {
    const stem = token.endsWith(suffix) ? token.slice(0, -suffix.length) : "";
    return stem ? forms.map((form) => [stem, form]) : [];
  });

  const said = longForms.find(([stem = "", form = ""]) =>
    texts.some((text) => hasPair(text, stem, form)),
  );

  return said ?? [token];
}

/** An 's or 'd contraction takes the long form that the sentence or the transcript has, if any. */
export function expandAmbiguousContractions({
  language,
  texts,
  tokens,
}: {
  language: string;
  texts: Texts;
  tokens: readonly string[];
}): readonly string[] {
  if (!isEnglish(language)) {
    return tokens;
  }

  return tokens.flatMap((token) => toLongForm({ texts, token }));
}

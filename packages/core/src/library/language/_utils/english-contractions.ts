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

function findContraction({
  expected,
  heard,
  index,
}: {
  expected: readonly string[];
  heard: readonly string[];
  index: number;
}): string | null {
  const [stem = "", next = ""] = heard.slice(index, index + 2);

  if (hasPair(expected, stem, next)) {
    return null;
  }

  const match = ENGLISH_AMBIGUOUS_CONTRACTIONS.find(
    ([suffix, longForms]) => longForms.includes(next) && expected.includes(`${stem}${suffix}`),
  );

  return match ? `${stem}${match[0]}` : null;
}

function findLongForm({
  expected,
  token,
}: {
  expected: readonly string[];
  token: string;
}): string[] | null {
  if (expected.includes(token)) {
    return null;
  }

  const longForms = ENGLISH_AMBIGUOUS_CONTRACTIONS.flatMap(([suffix, forms]) => {
    const stem = token.endsWith(suffix) ? token.slice(0, -suffix.length) : "";
    return stem ? forms.map((form) => [stem, form]) : [];
  });

  return longForms.find(([stem = "", form = ""]) => hasPair(expected, stem, form)) ?? null;
}

export function spellContractionsAsExpected({
  expected,
  heard,
  language,
}: {
  expected: readonly string[];
  heard: readonly string[];
  language: string;
}): readonly string[] {
  if (!isEnglish(language)) {
    return heard;
  }

  const spelled: string[] = [];
  let index = 0;

  while (index < heard.length) {
    const token = heard[index] ?? "";
    const contraction = findContraction({ expected, heard, index });

    if (contraction) {
      spelled.push(contraction);
      index += 2;
    } else {
      spelled.push(...(findLongForm({ expected, token }) ?? [token]));
      index += 1;
    }
  }

  return spelled;
}

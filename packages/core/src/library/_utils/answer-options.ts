import { seededShuffle } from "@zoonk/utils/seeded-random";

const OPTION_IDS = ["a", "b", "c", "d", "e"] as const;

/** Deterministic for the same option texts; shuffling prevents writer-order answer leakage. */
export function shuffleAnswerOptions<T extends { text: string }>(options: readonly T[]): T[] {
  return seededShuffle(options, options.map((option) => option.text).join("\n"));
}

export function getOptionId(index: number): string {
  return OPTION_IDS[index] ?? String(index);
}

const OPTION_LABEL = /^\s*(?:\((?<enclosed>[a-e])\)|(?<letter>[a-e])[).])\s+/iu;

type OptionLabel = { length: number; letter: string; shape: string };

function readOptionLabel(text: string): OptionLabel | null {
  const match = OPTION_LABEL.exec(text);
  const letter = match?.groups?.enclosed ?? match?.groups?.letter;

  if (!match || !letter) {
    return null;
  }

  return { length: match[0].length, letter, shape: match[0].trim().replace(letter, "") };
}

function isLabelSet(labels: readonly (OptionLabel | null)[]): labels is OptionLabel[] {
  const found = labels.filter((label) => label !== null);
  const letters = found.map((label) => label.letter);
  const expected = OPTION_IDS.slice(0, labels.length).join("");

  return (
    found.length === labels.length &&
    new Set(found.map((label) => label.shape)).size === 1 &&
    (letters.every((letter) => letter === letter.toUpperCase()) ||
      letters.every((letter) => letter === letter.toLowerCase())) &&
    letters
      .map((letter) => letter.toLowerCase())
      .toSorted()
      .join("") === expected
  );
}

export function stripOptionLabels<T extends { text: string }>(options: readonly T[]): T[] {
  const labels = options.map((option) => readOptionLabel(option.text));

  if (!isLabelSet(labels)) {
    return [...options];
  }

  return options.map((option, index) => ({
    ...option,
    text: option.text.slice(labels[index]?.length ?? 0),
  }));
}

const ORDINALS = [
  "primeira",
  "primeiro",
  "segunda",
  "segundo",
  "terceira",
  "terceiro",
  "quarta",
  "quarto",
  "quinta",
  "quinto",
  "última",
  "último",
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "last",
  "primera",
  "tercera",
  "cuarta",
  "première",
  "deuxième",
  "troisième",
  "quatrième",
  "dernière",
  "erste",
  "zweite",
  "dritte",
  "vierte",
  "letzte",
].join("|");

const PLAIN_ORDINALS = withoutAccents(ORDINALS);

const OPTION_NOUNS = ["opcao", "alternativa", "option", "choice", "opcion"].join("|");

const POSITION_PATTERNS: readonly { form: "plain" | "lower" | "accented"; pattern: RegExp }[] = [
  { form: "lower", pattern: new RegExp(`\\b(?:${PLAIN_ORDINALS}) (?:${OPTION_NOUNS})\\b`, "gu") },
  {
    form: "plain",
    pattern:
      /\b(?:[Oo]pcao|[Aa]lternativa|[Ll]etra|[Oo]ption|[Cc]hoice|[Ll]etter|[Oo]pcion|[Ll]ettre)\s+\(?[A-E]\)?(?![\p{L}\p{N}])/gu,
  },
  {
    /** Folding Portuguese "é" (is) to "e" would confuse it with the conjunction "e" (and). */
    form: "accented",
    pattern: new RegExp(
      `(?<![\\p{L}\\p{N}])(?:é|ser[ií]a|era|foi|is|was|es|ser[aá]|est|ist) (?:a|o|the|la|el|le|die|der) (?:${ORDINALS}|${PLAIN_ORDINALS})(?=\\s*(?:[.,;:!?)]|$))`,
      "gu",
    ),
  },
];

function withoutAccents(text: string): string {
  return text.normalize("NFD").replaceAll(/\p{M}/gu, "");
}

export function findOptionPositionReferences(text: string): string[] {
  const plain = withoutAccents(text);

  const forms = {
    accented: text.normalize("NFC").toLowerCase(),
    lower: plain.toLowerCase(),
    plain,
  };

  return POSITION_PATTERNS.flatMap(({ form, pattern }) =>
    [...forms[form].matchAll(pattern)].map((match) => match[0]),
  );
}

import { seededShuffle } from "@zoonk/utils/seeded-random";

const OPTION_IDS = ["a", "b", "c", "d", "e"] as const;

/**
 * Answer options in the order they're stored and shown. Writers tend to list the right answer
 * first, so options are shuffled once, the same way for the same options, and the position never
 * gives the answer away on any screen, review or public page.
 */
export function shuffleAnswerOptions<T extends { text: string }>(options: readonly T[]): T[] {
  return seededShuffle(options, options.map((option) => option.text).join("\n"));
}

/** Option ids are letters in the order the options are stored and shown. */
export function getOptionId(index: number): string {
  return OPTION_IDS[index] ?? String(index);
}

/** A letter printed before an option, as exam papers do: "A) ", "(b) ", "C. ". */
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

/**
 * Letters are labels only when every option has one, printed the same way, and together they run
 * from A with no gaps in one case. Content that happens to start like a label ("C. elegans", "A)
 * and B) are both…") never passes all of that.
 */
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

/**
 * Options without the letters a writer printed before them. Options are shuffled and every screen
 * shows its own badge, so a printed "D) " would read "A · D) …" and point at the wrong option.
 */
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
  "ultima",
  "ultimo",
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "last",
  "primera",
  "tercera",
  "cuarta",
  "premiere",
  "deuxieme",
  "troisieme",
  "quatrieme",
  "derniere",
  "erste",
  "zweite",
  "dritte",
  "vierte",
  "letzte",
].join("|");

/** Words that only ever name an answer option, unlike "answer" or "statement". */
const OPTION_NOUNS = ["opcao", "alternativa", "option", "choice", "opcion"].join("|");

/** "the second option", "a alternativa C", "it's the second." */
const POSITION_PATTERNS: readonly { cased: boolean; pattern: RegExp }[] = [
  { cased: false, pattern: new RegExp(`\\b(?:${ORDINALS}) (?:${OPTION_NOUNS})\\b`, "gu") },
  {
    cased: true,
    pattern:
      /\b(?:[Oo]pcao|[Aa]lternativa|[Ll]etra|[Oo]ption|[Cc]hoice|[Ll]etter|[Oo]pcion|[Ll]ettre)\s+\(?[A-E]\)?(?![\p{L}\p{N}])/gu,
  },
  {
    cased: false,
    pattern: new RegExp(
      `\\b(?:e|seria|era|foi|is|was|es|sera|est|ist) (?:a|o|the|la|el|le|die|der) (?:${ORDINALS})(?=\\s*(?:[.,;:!?)]|$))`,
      "gu",
    ),
  },
];

function withoutAccents(text: string): string {
  return text.normalize("NFD").replaceAll(/\p{M}/gu, "");
}

/**
 * Where feedback points at an answer option by its place ("é a segunda", "option C"). Options are
 * shuffled after they're written and every screen shows its own letters, so a position the writer
 * meant never matches the one the learner sees: feedback names an option by what it says.
 */
export function findOptionPositionReferences(text: string): string[] {
  const plain = withoutAccents(text);
  const lower = plain.toLowerCase();

  return POSITION_PATTERNS.flatMap(({ cased, pattern }) =>
    [...(cased ? plain : lower).matchAll(pattern)].map((match) => match[0]),
  );
}

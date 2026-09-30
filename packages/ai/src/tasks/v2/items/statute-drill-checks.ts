import { normalizeString } from "@zoonk/utils/string";
import { type StatuteArticle, type StatuteDrill } from "./statute-drills";

/** Prompts ask for "____", but a gap of any length reads the same to a learner. */
const GAP_PATTERN = /_{3,}/gu;
const NON_WORD_PATTERN = /[^\p{L}\p{N}\s]/gu;

/** Words that flip a clause when a statement adds or drops them, compared without accents. */
const NEGATIONS = new Set(["nao", "nunca", "jamais", "no", "not", "never"]);

/** Words kept on each side of a negation, and the fewest that make a match meaningful. */
const NEGATION_CONTEXT_WORDS = 3;
const MIN_NEGATION_CONTEXT_WORDS = 4;

/**
 * A set where one answer is right more than 3 times as often as the other can
 * be passed by always giving that answer, so its surplus drills are dropped,
 * keeping at least one.
 */
const MAX_MAJORITY_RATIO = 3;

type Problem = string | false;
type CheckedDrill = { drill: StatuteDrill; problems: string[] };
type DrillOf<FORMAT extends StatuteDrill["format"]> = Extract<StatuteDrill, { format: FORMAT }>;

/** Case, accents, spacing and punctuation never change which words a passage has. */
function toWords(text: string): string[] {
  return normalizeString(text.replaceAll(NON_WORD_PATTERN, " ")).split(" ").filter(Boolean);
}

function containsWords(text: readonly string[], passage: readonly string[]): boolean {
  return passage.length > 0 && ` ${text.join(" ")} `.includes(` ${passage.join(" ")} `);
}

/**
 * Whether `target` has the words around the negation at `index` in `source`
 * without the negation itself: "sera obrigado a" where the source says "nao
 * sera obrigado a".
 */
function dropsNegationAt({
  index,
  source,
  target,
}: {
  index: number;
  source: readonly string[];
  target: readonly string[];
}): boolean {
  const word = source[index] ?? "";
  const before = source.slice(Math.max(0, index - NEGATION_CONTEXT_WORDS), index);
  const after = source.slice(index + 1, index + 1 + NEGATION_CONTEXT_WORDS);
  const withoutNegation = [...before, ...after];

  return (
    NEGATIONS.has(word) &&
    withoutNegation.length >= MIN_NEGATION_CONTEXT_WORDS &&
    containsWords(target, withoutNegation) &&
    !containsWords(target, [...before, word, ...after])
  );
}

function dropsNegation(source: readonly string[], target: readonly string[]): boolean {
  return source.some((_, index) => dropsNegationAt({ index, source, target }));
}

/** A true statement that adds or drops a negation says the opposite of its article. */
function flipsNegation(statement: readonly string[], article: readonly string[]): boolean {
  return dropsNegation(statement, article) || dropsNegation(article, statement);
}

function checkTrueFalse(drill: DrillOf<"trueFalse">, article: readonly string[]): Problem[] {
  const statement = toWords(drill.statement);

  return [
    !drill.isTrue &&
      containsWords(article, statement) &&
      "A false statement repeats its article word for word.",
    drill.isTrue &&
      flipsNegation(statement, article) &&
      "A true statement adds or drops a negation from its article.",
  ];
}

function checkGap(drill: DrillOf<"typed">, article: readonly string[]): Problem[] {
  const gaps = drill.question.match(GAP_PATTERN)?.length ?? 0;
  const [answer] = drill.acceptedAnswers;

  if (gaps !== 1) {
    return [`Has ${gaps} gaps instead of 1.`];
  }

  if (!answer?.trim()) {
    return ["Has no accepted answer for its gap."];
  }

  const filled = toWords(drill.question.replace(GAP_PATTERN, ` ${answer} `));

  return [
    !containsWords(article, filled) &&
      "Filled with its first accepted answer, the passage doesn't match the article.",
  ];
}

/** Multiple-choice drills only need the item checks every item runs in `@zoonk/core`. */
function checkFormat(drill: StatuteDrill, article: readonly string[]): Problem[] {
  if (drill.format === "trueFalse") {
    return checkTrueFalse(drill, article);
  }

  return drill.format === "typed" ? checkGap(drill, article) : [];
}

/** Multiple-choice drills can share a command ("De acordo com a lei,"), so only statements and passages must differ. */
function getRepeatKey(drill: StatuteDrill): string | null {
  if (drill.format === "multipleChoice") {
    return null;
  }

  return toWords(drill.format === "trueFalse" ? drill.statement : drill.question).join(" ");
}

function findArticle(
  articles: readonly StatuteArticle[],
  reference: string,
): StatuteArticle | undefined {
  const key = normalizeString(reference);
  return articles.find((article) => normalizeString(article.reference) === key);
}

function checkDrill({
  articles,
  drill,
  earlier,
}: {
  articles: readonly StatuteArticle[];
  drill: StatuteDrill;
  earlier: readonly StatuteDrill[];
}): CheckedDrill {
  const article = findArticle(articles, drill.reference);

  if (!article) {
    return { drill, problems: [`Cites "${drill.reference}", which isn't one of the articles.`] };
  }

  const key = getRepeatKey(drill);

  const problems = [
    ...checkFormat(drill, toWords(article.text)),
    key !== null &&
      earlier.some((other) => getRepeatKey(other) === key) &&
      "Repeats an earlier drill.",
  ].filter((problem) => typeof problem === "string");

  return { drill: { ...drill, reference: article.reference }, problems };
}

function isPassingStatement(
  entry: CheckedDrill,
): entry is { drill: DrillOf<"trueFalse">; problems: string[] } {
  return entry.problems.length === 0 && entry.drill.format === "trueFalse";
}

function balanceTrueFalse(checked: readonly CheckedDrill[]): CheckedDrill[] {
  const statements = checked.filter((entry) => isPassingStatement(entry));
  const trueCount = statements.filter((entry) => entry.drill.isTrue).length;
  const falseCount = statements.length - trueCount;
  const majorityIsTrue = trueCount > falseCount;
  const maxMajority = Math.max(1, Math.min(trueCount, falseCount) * MAX_MAJORITY_RATIO);

  const surplus = new Set<CheckedDrill>(
    statements.filter((entry) => entry.drill.isTrue === majorityIsTrue).slice(maxMajority),
  );

  const problem = `Dropped to balance true and false statements (${trueCount} true, ${falseCount} false).`;

  return checked.map((entry) => (surplus.has(entry) ? { ...entry, problems: [problem] } : entry));
}

/**
 * The statute rules a drill must meet, which a schema can't express: it cites
 * one of the given articles, a fill-in-the-blank passage filled with its answer
 * is the article's own text, a false statement isn't the text itself, a true
 * one doesn't negate it, no statement repeats, and true and false answers are
 * roughly balanced. Returns the passing drills, with each reference spelled as
 * the caller gave it, and the dropped ones with their problems.
 */
export function checkStatuteDrills({
  articles,
  drills,
}: {
  articles: readonly StatuteArticle[];
  drills: readonly StatuteDrill[];
}): { drills: StatuteDrill[]; dropped: CheckedDrill[] } {
  const checked = balanceTrueFalse(
    drills.map((drill, index) => checkDrill({ articles, drill, earlier: drills.slice(0, index) })),
  );

  return {
    drills: checked.filter((entry) => entry.problems.length === 0).map((entry) => entry.drill),
    dropped: checked.filter((entry) => entry.problems.length > 0),
  };
}

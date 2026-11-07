import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskCodeChecks, type TaskScorer } from "@/lib/types";
import { reordersWords } from "@/lib/words";
import { type LanguageSentenceOrders } from "@zoonk/ai/tasks/language/language-sentence-orders";
import {
  type SentenceOrders,
  keepSentenceOrders,
} from "@zoonk/core/library/language/sentence-orders";
import { normalizeArrangeWord } from "@zoonk/core/player/contracts/arrange-words-answers";
import { isSameLanguage } from "@zoonk/utils/languages";
import { SENTENCE_ORDERS_SCORE_CATEGORIES } from "./score-categories";
import { type SentenceOrdersExpected, type SentenceOrdersInput } from "./test-cases";

type Side = keyof SentenceOrders;
type Sentence = SentenceOrdersInput["sentences"][number];

const SIDES = [
  { expected: "orders", side: "otherOrders" },
  { expected: "translationOrders", side: "otherTranslationOrders" },
] as const;

function parseOutput(output: string): LanguageSentenceOrders | null {
  try {
    return JSON.parse(output) as LanguageSentenceOrders;
  } catch {
    return null;
  }
}

/** A kept order has a space between its tiles, so its words are its tiles. */
function toOrderKey(kept: string): string {
  return kept
    .split(" ")
    .map((word) => normalizeArrangeWord(word))
    .join(" ");
}

/** The order as the pipeline keeps it, or null when the sentence's own tiles can't build it. */
function keepOne({
  order,
  sameLanguage,
  sentence,
  side,
}: {
  order: string;
  sameLanguage: boolean;
  sentence: Sentence;
  side: Side;
}): string | null {
  const orders = { otherOrders: [], otherTranslationOrders: [], [side]: [order] };
  const kept = keepSentenceOrders({ sameLanguage, sentence: { ...sentence, ...orders } });

  return kept[side][0] ?? null;
}

function checkSide({
  expected,
  sameLanguage,
  sentence,
  side,
  written,
}: {
  expected: SentenceOrdersExpected["sentences"][number]["orders"];
  sameLanguage: boolean;
  sentence: Sentence;
  side: Side;
  written: string[];
}): Omit<CodeCheckResult, "judgedOutput"> {
  const keep = (order: string) => keepOne({ order, sameLanguage, sentence, side });

  const toKeys = (orders: readonly string[]) =>
    new Set(orders.flatMap((order) => keep(order) ?? []).map((kept) => toOrderKey(kept)));

  const keptKeys = toKeys(written);
  const invalidKeys = toKeys(expected.invalid);
  const text = side === "otherOrders" ? sentence.sentence : sentence.translation;

  const unbuildable = written.filter((order) => !keep(order) && !reordersWords({ order, text }));
  const wrong = written.filter((order) => invalidKeys.has(toOrderKey(keep(order) ?? "")));
  const missed = expected.valid.filter((order) => !keptKeys.has(toOrderKey(keep(order) ?? "")));

  return {
    passed:
      (unbuildable.length + wrong.length === 0 ? 1 : 0) + expected.valid.length - missed.length,
    problems: [
      ...unbuildable.map(
        (order) => `"${order}" isn't another order of "${sentence.sentence}"'s words.`,
      ),
      ...wrong.map((order) => `"${order}" is listed but wrong.`),
      ...missed.map((order) => `"${order}" is missing.`),
    ],
    total: 1 + expected.valid.length,
  };
}

/** Precision on every written order and recall on the orders a teacher expects, per side. */
function checkOrders({
  expected,
  input,
  output,
}: {
  expected: SentenceOrdersExpected;
  input: SentenceOrdersInput;
  output: string;
}): CodeCheckResult {
  const parsed = parseOutput(output);

  if (!parsed) {
    return {
      judgedOutput: output,
      passed: 0,
      problems: ["The output isn't a list of orders."],
      total: 1,
    };
  }

  const sameLanguage = isSameLanguage(input);
  const sides = sameLanguage ? SIDES.slice(0, 1) : SIDES;

  const checks = input.sentences.flatMap((sentence, index) =>
    sides.map(({ expected: expectedSide, side }) =>
      checkSide({
        expected: expected.sentences[index]?.[expectedSide] ?? { invalid: [], valid: [] },
        sameLanguage,
        sentence,
        side,
        written: parsed.sentences[index]?.[side] ?? [],
      }),
    ),
  );

  const kept = input.sentences.map((sentence, index) => ({
    ...sentence,
    ...keepSentenceOrders({
      sameLanguage,
      sentence: {
        ...sentence,
        otherOrders: parsed.sentences[index]?.otherOrders ?? [],
        otherTranslationOrders: parsed.sentences[index]?.otherTranslationOrders ?? [],
      },
    }),
  }));

  return {
    judgedOutput: JSON.stringify({ sentences: kept }),
    passed: checks.reduce((sum, check) => sum + check.passed, 0),
    problems: checks.flatMap((check) => check.problems),
    total: checks.reduce((sum, check) => sum + check.total, 0),
  };
}

export const checkLanguageSentenceOrders: TaskCodeChecks<SentenceOrdersExpected> = ({
  output,
  testCase,
}) =>
  checkOrders({
    expected: testCase.expected ?? { sentences: [] },
    input: testCase.userInput as SentenceOrdersInput,
    output,
  });

export const scoreLanguageSentenceOrders: TaskScorer<SentenceOrdersExpected> = ({
  output,
  testCase,
}) =>
  scoreWithCodeChecks({
    check: (value) => checkLanguageSentenceOrders({ output: value, testCase }),
    output,
    scoreCategories: SENTENCE_ORDERS_SCORE_CATEGORIES,
    testCase,
  });

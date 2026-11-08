import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskCodeChecks, type TaskScorer } from "@/lib/types";
import {
  type SentenceOrders,
  keepSentenceOrders,
} from "@zoonk/core/library/language/sentence-orders";
import { normalizeArrangeWord } from "@zoonk/core/player/contracts/arrange-words-answers";
import { isSameLanguage } from "@zoonk/utils/languages";
import { SENTENCE_ORDERS_SCORE_CATEGORIES } from "./score-categories";
import { type SentenceOrdersExpected, type SentenceOrdersInput } from "./test-cases";

/** What the pipeline saves for each sentence, with the candidates its review read. */
export type CheckedSentenceOrders = {
  sentences: (SentenceOrders & { candidates?: SentenceOrders })[];
};

type Side = keyof SentenceOrders;
type Sentence = SentenceOrdersInput["sentences"][number];

const SIDES = [
  { expected: "orders", side: "otherOrders" },
  { expected: "translationOrders", side: "otherTranslationOrders" },
] as const;

function parseOutput(output: string): CheckedSentenceOrders | null {
  try {
    return JSON.parse(output) as CheckedSentenceOrders;
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

/** Each side scores one part for keeping no real error and one per valid order kept. */
function checkSide({
  expected,
  kept,
  sameLanguage,
  sentence,
  side,
}: {
  expected: SentenceOrdersExpected["sentences"][number]["orders"];
  kept: string[];
  sameLanguage: boolean;
  sentence: Sentence;
  side: Side;
}): Omit<CodeCheckResult, "judgedOutput"> {
  const toKey = (order: string) =>
    toOrderKey(keepOne({ order, sameLanguage, sentence, side }) ?? "");

  const keptKeys = new Set(kept.map((order) => toOrderKey(order)));
  const invalidKeys = new Set(expected.invalid.map((order) => toKey(order)));

  const errors = kept.filter((order) => invalidKeys.has(toOrderKey(order)));
  const missed = expected.valid.filter((order) => !keptKeys.has(toKey(order)));

  return {
    passed: (errors.length === 0 ? 1 : 0) + expected.valid.length - missed.length,
    problems: [
      ...errors.map((order) => `"${order}" is kept but wrong.`),
      ...missed.map((order) => `"${order}" is missing.`),
    ],
    total: 1 + expected.valid.length,
  };
}

/** Real errors among the kept orders, and the valid orders a teacher expects that were missed. */
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
        kept: parsed.sentences[index]?.[side] ?? [],
        sameLanguage,
        sentence,
        side,
      }),
    ),
  );

  const judged = input.sentences.map((sentence, index) => ({
    ...sentence,
    otherOrders: parsed.sentences[index]?.otherOrders ?? [],
    otherTranslationOrders: parsed.sentences[index]?.otherTranslationOrders ?? [],
  }));

  return {
    judgedOutput: JSON.stringify({ sentences: judged }),
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

import { type Item, type ItemFormat } from "@zoonk/db";
import { type JsonObject } from "@zoonk/utils/json";
import {
  type ChoiceItem,
  getChoiceCorrectAnswer,
  gradeChoiceAnswer,
  hasMisconceptions,
  parseChoiceItem,
  toQuestionView,
} from "../../learner/_utils/choice-items";
import {
  type MathItem,
  describeEarlierMathAnswer,
  gradeMathAnswer,
  parseMathItem,
  readRecordedMath,
  serveMath,
  toMathQuestionView,
} from "../../learner/_utils/math-items";
import { type MistakeSnapshot } from "../../mistakes/mistake-snapshot";
import { type QuestionAnswer, studyAnswerInputSchema } from "../contract";
import { type MatchItem, gradeMatch, parseMatchItem, toMatchQuestion } from "./match-items";

/**
 * Formats a session grades on the server: quick choice questions, true-or-false statements, match
 * pairs and math problems, which come back with new numbers every time. Typed, spoken and essay
 * answers need the item bank's graders and join sessions with the produce blocks.
 */
export const SESSION_ITEM_FORMATS = [
  "multipleChoice",
  "trueFalse",
  "matchPairs",
  "numeric",
] as const satisfies ItemFormat[];

/** Formats asked one at a time with one answer: practice, mistake drills and checkpoints. */
export const QUESTION_ITEM_FORMATS = [
  "multipleChoice",
  "trueFalse",
  "numeric",
] as const satisfies ItemFormat[];

export type SessionItem = ChoiceItem | MatchItem | MathItem;

type BankItem = Pick<Item, "content" | "format" | "id" | "language" | "skillId">;

/** Reads a bank item as a question a session can ask, or null for other formats. */
export function parseSessionItem(item: BankItem): SessionItem | null {
  if (item.format === "matchPairs") {
    return parseMatchItem(item);
  }

  return item.format === "numeric" ? parseMathItem(item) : parseChoiceItem(item);
}

/**
 * Whether a wrong answer is tagged with a misconception, which trap drills and bosses look for.
 * Every math problem names its common mistakes.
 */
export function hasTraps(item: SessionItem): boolean {
  if (item.format === "matchPairs") {
    return false;
  }

  return item.format === "numeric" || hasMisconceptions(item);
}

/** Each block that asks a math problem draws its own numbers, the same on every visit. */
function serveInBlock({ blockId, item }: { blockId: string; item: MathItem }) {
  return serveMath({ item, seed: `${blockId}:${item.id}` });
}

/** The question as the learner sees it in a block, never with its answer. */
export function toSessionQuestion({ blockId, item }: { blockId: string; item: SessionItem }) {
  if (item.format === "numeric") {
    const version = serveInBlock({ blockId, item });
    return { ...toMathQuestionView({ item, version }), left: null, right: null };
  }

  if (item.format !== "matchPairs") {
    return { ...toQuestionView(item), left: null, right: null, unit: null };
  }

  return toMatchQuestion(item);
}

export type SessionQuestion = ReturnType<typeof toSessionQuestion>;

export type GradedSessionAnswer = {
  correctAnswer: QuestionAnswer;
  explanation: string | null;
  isCorrect: boolean;
  /** What the attempt stores: the answer, with the numbers a math problem was asked with. */
  recorded: JsonObject;
  snapshot: MistakeSnapshot;
  workedSteps: string[];
};

function gradeChoice({
  answer,
  item,
}: {
  answer: QuestionAnswer;
  item: ChoiceItem;
}): GradedSessionAnswer {
  const choice = "matches" in answer || "number" in answer ? { dontKnow: true as const } : answer;
  const graded = gradeChoiceAnswer({ answer: choice, item });

  return {
    correctAnswer: getChoiceCorrectAnswer(item),
    explanation: graded.snapshot.explanation ?? null,
    isCorrect: graded.isCorrect,
    recorded: answer,
    snapshot: graded.snapshot,
    workedSteps: [],
  };
}

/**
 * Grades an answer to a question of a block, a math problem against the numbers the block showed.
 * A shape meant for another format counts as wrong, like any wrong pick.
 */
export function gradeSessionAnswer({
  answer,
  blockId,
  item,
}: {
  answer: QuestionAnswer;
  blockId: string;
  item: SessionItem;
}): GradedSessionAnswer {
  if (item.format === "matchPairs") {
    return gradeMatch({ answer, item });
  }

  if (item.format !== "numeric") {
    return gradeChoice({ answer, item });
  }

  return gradeMathAnswer({
    answer: "number" in answer ? answer.number : null,
    item,
    version: serveInBlock({ blockId, item }),
  });
}

/**
 * An answer from an earlier session as text, for the time machine. Match answers have no single
 * text, and a math answer only reads as text when that serving had today's numbers.
 */
export function describeEarlierAnswer({
  answer,
  blockId,
  item,
}: {
  answer: unknown;
  blockId: string;
  item: SessionItem;
}): string | null {
  if (item.format === "numeric") {
    return describeEarlierMathAnswer({ answer, item, version: serveInBlock({ blockId, item }) });
  }

  const parsed = studyAnswerInputSchema.shape.answer.safeParse(answer);

  if (!parsed.success || item.format === "matchPairs") {
    return null;
  }

  if ("isTrue" in parsed.data) {
    return String(parsed.data.isTrue);
  }

  if ("selectedIndex" in parsed.data && item.format === "multipleChoice") {
    return item.content.options[parsed.data.selectedIndex]?.text ?? null;
  }

  return null;
}

/**
 * An answer as its attempt stored it, in the shape it was given: a math answer also keeps the
 * numbers it was asked with, which the answer shape doesn't carry.
 */
export function readRecordedAnswer(answer: unknown): QuestionAnswer | null {
  const parsed = studyAnswerInputSchema.shape.answer.safeParse(answer);

  if (parsed.success) {
    return parsed.data;
  }

  const math = readRecordedMath(answer);
  return math && math.number !== null ? { number: math.number } : null;
}

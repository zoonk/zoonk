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
import {
  type TypedItem,
  getTypedCorrectAnswer,
  matchesAcceptedAnswer,
  parseTypedItem,
  toTypedQuestionView,
  toTypedSnapshot,
} from "../../learner/_utils/typed-items";
import { choiceAnswerSchema } from "../../learner/contract";
import { type MistakeSnapshot } from "../../mistakes/mistake-snapshot";
import { type QuestionAnswer, studyAnswerInputSchema } from "../contract";
import { type MatchItem, gradeMatch, parseMatchItem, toMatchQuestion } from "./match-items";
import { type OrderItem, gradeOrder, parseOrderItem, toOrderQuestion } from "./order-items";

/**
 * Formats review capsules ask: quick choice questions, true-or-false statements, match pairs and
 * math problems, which come back with new numbers every time.
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

/**
 * The questions practice asks: `QUESTION_ITEM_FORMATS`, ordering questions, and short typed
 * answers (a word, a number, a term) with the wordings code accepts, graded by code first and by a
 * model only on a miss. Typed explanations, spoken answers and essays join sessions with the
 * produce blocks.
 */
export function getPracticeItemFilter() {
  return {
    OR: [
      { format: { in: [...QUESTION_ITEM_FORMATS, "order" as const] } },
      { NOT: { content: { equals: [], path: ["acceptedAnswers"] } }, format: "typed" as const },
    ],
  };
}

export type SessionItem = ChoiceItem | MatchItem | MathItem | OrderItem | TypedItem;

type BankItem = Pick<Item, "content" | "format" | "id" | "language" | "skillId">;

/** Reads a bank item as a question a session can ask, or null for other formats. */
export function parseSessionItem(item: BankItem): SessionItem | null {
  switch (item.format) {
    case "matchPairs":
      return parseMatchItem(item);
    case "numeric":
      return parseMathItem(item);
    case "order":
      return parseOrderItem(item);
    case "typed":
      return parseTypedItem(item);
    case "multipleChoice":
    case "trueFalse":
      return parseChoiceItem(item);
    case "essay":
    case "spoken":
      return null;
    default:
      throw new Error("Unknown item format.");
  }
}

/**
 * Whether a wrong answer is tagged with a misconception, which trap drills and bosses look for.
 * Every math problem names its common mistakes.
 */
export function hasTraps(item: SessionItem): boolean {
  if (item.format === "numeric") {
    return true;
  }

  return (
    (item.format === "multipleChoice" || item.format === "trueFalse") && hasMisconceptions(item)
  );
}

/** Each block that asks a math problem draws its own numbers, the same on every visit. */
function serveInBlock({ blockId, item }: { blockId: string; item: MathItem }) {
  return serveMath({ item, seed: `${blockId}:${item.id}` });
}

/** What a session question shows only for other formats. */
const NO_EXTRAS = { entry: null, left: null, right: null, select: null, unit: null };

/** The question as the learner sees it in a block, never with its answer. */
export function toSessionQuestion({ blockId, item }: { blockId: string; item: SessionItem }) {
  switch (item.format) {
    case "numeric": {
      const version = serveInBlock({ blockId, item });
      return { ...NO_EXTRAS, ...toMathQuestionView({ item, version }) };
    }
    case "matchPairs":
      return { ...NO_EXTRAS, ...toMatchQuestion(item) };
    case "order":
      return toOrderQuestion(item);
    case "typed":
      return { ...NO_EXTRAS, ...toTypedQuestionView(item) };
    case "multipleChoice":
    case "trueFalse":
      return { ...NO_EXTRAS, ...toQuestionView(item) };
    default:
      throw new Error("Unknown session item format.");
  }
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
  const choice = choiceAnswerSchema.safeParse(answer).data ?? { dontKnow: true as const };
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
 * A typed answer graded by code alone: right when it's an accepted wording. Answering grades a
 * miss again with a model (`gradeTypedItemAnswer`); a checkpoint's results read the verdict here.
 */
function gradeTypedByCode({
  answer,
  item,
}: {
  answer: QuestionAnswer;
  item: TypedItem;
}): GradedSessionAnswer {
  const text = "text" in answer ? answer.text : null;
  const isCorrect = text !== null && matchesAcceptedAnswer({ item, text });

  return {
    correctAnswer: { text: getTypedCorrectAnswer(item) },
    explanation: null,
    isCorrect,
    recorded: answer,
    snapshot: toTypedSnapshot({ explanation: null, item, text }),
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
  switch (item.format) {
    case "matchPairs":
      return gradeMatch({ answer, item });
    case "numeric":
      return gradeMathAnswer({
        answer: "number" in answer ? answer.number : null,
        item,
        version: serveInBlock({ blockId, item }),
      });
    case "order":
      return gradeOrder({ answer, item });
    case "typed":
      return gradeTypedByCode({ answer, item });
    case "multipleChoice":
    case "trueFalse":
      return gradeChoice({ answer, item });
    default:
      throw new Error("Unknown session item format.");
  }
}

/**
 * An answer from an earlier session as text, for the time machine. Match and ordering answers have
 * no single text, and a math answer only reads as text when that serving had today's numbers.
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

  if (!parsed.success || item.format === "matchPairs" || item.format === "order") {
    return null;
  }

  if ("text" in parsed.data) {
    return parsed.data.text;
  }

  if ("isTrue" in parsed.data) {
    return String(parsed.data.isTrue);
  }

  if (item.format !== "multipleChoice") {
    return null;
  }

  if ("selectedIndex" in parsed.data) {
    return item.content.options[parsed.data.selectedIndex]?.text ?? null;
  }

  return "selectedIndexes" in parsed.data
    ? parsed.data.selectedIndexes
        .map((index) => item.content.options[index]?.text ?? "?")
        .join("; ")
    : null;
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

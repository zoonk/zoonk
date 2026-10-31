import { type Item, type ItemFormat } from "@zoonk/db";
import { type JsonObject, isJsonObject } from "@zoonk/utils/json";
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

/** Review capsules draw fresh numeric values on each visit. */
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

const SHORT_TYPED_ANSWER = {
  NOT: { content: { equals: [], path: ["acceptedAnswers"] } },
  format: "typed" as const,
};

/** Typed practice requires accepted wordings; explanations, speech, and essays belong to produce blocks. */
export function getPracticeItemFilter({ typed }: { typed: boolean }) {
  return {
    OR: [
      { format: { in: [...QUESTION_ITEM_FORMATS, "order" as const] } },
      ...(typed ? [SHORT_TYPED_ANSWER] : []),
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

export function hasTraps(item: SessionItem): boolean {
  if (item.format === "numeric") {
    return true;
  }

  return (
    (item.format === "multipleChoice" || item.format === "trueFalse") && hasMisconceptions(item)
  );
}

/** Seed per block so each visit shows the same numbers. */
function serveInBlock({ blockId, item }: { blockId: string; item: MathItem }) {
  return serveMath({ item, seed: `${blockId}:${item.id}` });
}

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

/** Checkpoint results use code verdicts; live typed submissions retry code misses with model grading. */
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

/** Grades against the block's displayed numbers; answer shapes for other formats count as wrong. */
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

/** Returns null for match/order answers and numeric servings whose numbers differ from today's. */
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

/** Includes the numbers a math answer was asked with, which QuestionAnswer alone does not carry. */
export function readRecordedAnswer(answer: unknown): QuestionAnswer | null {
  /** Correction evidence belongs to persistence, while the public answer remains strict. */
  const input = isJsonObject(answer)
    ? Object.fromEntries(Object.entries(answer).filter(([key]) => key !== "fixedMistakeIds"))
    : answer;

  const parsed = studyAnswerInputSchema.shape.answer.safeParse(input);

  if (parsed.success) {
    return parsed.data;
  }

  const math = readRecordedMath(answer);
  return math && math.number !== null ? { number: math.number } : null;
}

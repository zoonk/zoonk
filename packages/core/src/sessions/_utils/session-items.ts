import { type ItemFormat } from "@zoonk/db";
import { type JsonObject, isJsonObject } from "@zoonk/utils/json";
import {
  type BankItem as ChoiceBankItem,
  type ChoiceItem,
  getChoiceCorrectAnswer,
  gradeChoiceAnswer,
  hasMisconceptions,
  parseChoiceItem,
  showChoiceItem,
  toQuestionView,
} from "../../learner/_utils/choice-items";
import {
  type MathItem,
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
import { type ItemSetView } from "../../library/items/item-set-view";
import { toItemSetView } from "../../library/items/item-sets";
import { type RecordedMistakeSnapshot as MistakeSnapshot } from "../../mistakes/mistake-snapshot";
import { type QuestionAnswer, studyAnswerInputSchema } from "../contract";
import {
  type MatchItem,
  getMatchKey,
  gradeMatch,
  parseMatchItem,
  toMatchQuestion,
} from "./match-items";
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

export type SessionItem = (ChoiceItem | MatchItem | MathItem | OrderItem | TypedItem) & {
  set?: ItemSetView | null;
};

type BankItem = ChoiceBankItem;

/** Reads a bank item as a question a session can ask, or null for other formats. */
function parseSessionItemContent(item: BankItem): SessionItem | null {
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

export function parseSessionItem(item: BankItem): SessionItem | null {
  const parsed = parseSessionItemContent(item);

  const set = item.set
    ? toItemSetView({ item: { set: item.set, setPosition: item.setPosition ?? null } })
    : null;

  return parsed ? { ...parsed, set } : null;
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

/**
 * Each block shows its own option order, so a question that returns tests its options rather than
 * their places. A block made before that (`storedOptionOrder`) keeps the stored order.
 */
export function showChoiceInBlock({
  blockId,
  item,
  keepsStoredOrder = false,
}: {
  blockId: string;
  item: ChoiceItem;
  keepsStoredOrder?: boolean;
}) {
  return keepsStoredOrder ? item : showChoiceItem({ item, seed: `${blockId}:${item.id}` });
}

const NO_EXTRAS = { entry: null, key: null, left: null, right: null, select: null, unit: null };

export function toSessionQuestion({
  blockId,
  item,
  keepsStoredOrder,
  revealMatchKey = false,
}: {
  blockId: string;
  item: SessionItem;
  keepsStoredOrder?: boolean;
  revealMatchKey?: boolean;
}) {
  switch (item.format) {
    case "numeric": {
      const version = serveInBlock({ blockId, item });
      return { ...NO_EXTRAS, ...toMathQuestionView({ item, version }) };
    }
    case "matchPairs":
      return {
        ...NO_EXTRAS,
        ...toMatchQuestion({ blockId, item }),
        key: revealMatchKey ? getMatchKey({ blockId, item }) : null,
      };
    case "order":
      return { ...NO_EXTRAS, ...toOrderQuestion({ blockId, item }) };
    case "typed":
      return { ...NO_EXTRAS, ...toTypedQuestionView(item) };
    case "multipleChoice":
    case "trueFalse":
      return {
        ...NO_EXTRAS,
        ...toQuestionView(showChoiceInBlock({ blockId, item, keepsStoredOrder })),
      };
    default:
      throw new Error("Unknown session item format.");
  }
}

export type SessionQuestion = ReturnType<typeof toSessionQuestion>;

/** A choice, match or order answer is indexes into the order its block showed, so it reads back only there. */
export function readsAnswerInBlockOrder(item: SessionItem): boolean {
  return (
    item.format === "multipleChoice" || item.format === "matchPairs" || item.format === "order"
  );
}

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
  blockId,
  item,
  keepsStoredOrder,
}: {
  answer: QuestionAnswer;
  blockId: string;
  item: ChoiceItem;
  keepsStoredOrder?: boolean;
}): GradedSessionAnswer {
  const choice = choiceAnswerSchema.safeParse(answer).data ?? { dontKnow: true as const };
  const shown = showChoiceInBlock({ blockId, item, keepsStoredOrder });
  const graded = gradeChoiceAnswer({ answer: choice, item, shown });

  return {
    correctAnswer: getChoiceCorrectAnswer(shown),
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
  keepsStoredOrder,
}: {
  answer: QuestionAnswer;
  blockId: string;
  item: SessionItem;
  keepsStoredOrder?: boolean;
}): GradedSessionAnswer {
  switch (item.format) {
    case "matchPairs":
      return gradeMatch({ answer, blockId, item });
    case "numeric":
      return gradeMathAnswer({
        answer: "number" in answer ? answer.number : null,
        item,
        version: serveInBlock({ blockId, item }),
      });
    case "order":
      return gradeOrder({ answer, blockId, item });
    case "typed":
      return gradeTypedByCode({ answer, item });
    case "multipleChoice":
    case "trueFalse":
      return gradeChoice({ answer, blockId, item, keepsStoredOrder });
    default:
      throw new Error("Unknown session item format.");
  }
}

/** Includes the numbers a math answer was asked with, which QuestionAnswer alone does not carry. */
export function readRecordedAnswer(answer: unknown): QuestionAnswer | null {
  /** Correction evidence belongs to persistence, while the public answer remains strict. */
  const input = isJsonObject(answer)
    ? Object.fromEntries(
        Object.entries(answer).filter(
          ([key]) =>
            key !== "fixedMistakeIds" &&
            key !== "practiceMistakeId" &&
            key !== "practiceShowing" &&
            key !== "placementRecheck" &&
            key !== "passedOverMiss",
        ),
      )
    : answer;

  const parsed = studyAnswerInputSchema.shape.answer.safeParse(input);

  if (parsed.success) {
    return parsed.data;
  }

  const math = readRecordedMath(answer);
  return math && math.number !== null ? { number: math.number } : null;
}

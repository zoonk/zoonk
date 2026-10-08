import { type Item, type ItemFormat, type MediaAsset } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";
import { type ParsedItemContent, parseItemContent } from "../../library/items/item-content";
import { type ItemImage, toItemImage } from "../../library/items/item-image";
import { type MistakeSnapshot } from "../../mistakes/mistake-snapshot";
import { type ChoiceAnswer } from "../contract";

/**
 * Formats graded here on the server: one right option, or a true or false statement. Placement,
 * test-outs, mocks and "Practice mistakes" ask only these; session blocks also ask match pairs and
 * math problems with fresh numbers (`sessions/_utils/session-items`).
 */
export const GRADABLE_ITEM_FORMATS = [
  "multipleChoice",
  "trueFalse",
] as const satisfies ItemFormat[];

type ChoiceContent = Extract<ParsedItemContent, { format: (typeof GRADABLE_ITEM_FORMATS)[number] }>;

/** A bank question with the picture it shows, when it's about one. */
export type ChoiceItem = Pick<Item, "id" | "language" | "skillId"> &
  ChoiceContent & { image: ItemImage | null };

/**
 * A bank item as reads return it. Reads that show questions include its picture's file
 * (`ITEM_IMAGE_INCLUDE`); grading reads leave it out.
 */
export type BankItem = Pick<Item, "content" | "format" | "id" | "language" | "skillId"> & {
  mediaAsset?: Pick<MediaAsset, "height" | "url" | "width"> | null;
};

function isGradableFormat(format: ItemFormat): format is ChoiceContent["format"] {
  return GRADABLE_ITEM_FORMATS.some((gradable) => gradable === format);
}

/**
 * Reads a bank item as a choice question, or null when it isn't one. Stored content passed the
 * item checks, so a parse failure is logged and the item skipped instead of failing the learner.
 */
export function parseChoiceItem(item: BankItem): ChoiceItem | null {
  if (!isGradableFormat(item.format)) {
    return null;
  }

  try {
    const parsed = parseItemContent({ content: item.content, format: item.format });

    return parsed.format === "multipleChoice" || parsed.format === "trueFalse"
      ? {
          ...parsed,
          id: item.id,
          image: toItemImage({ content: parsed.content, mediaAsset: item.mediaAsset }),
          language: item.language,
          skillId: item.skillId,
        }
      : null;
  } catch (error) {
    logError(`Item ${item.id} has content that doesn't match its format.`, error);
    return null;
  }
}

/** The question as the learner sees it: never which answer is right or why. */
export function toQuestionView(item: ChoiceItem) {
  const base = {
    context: item.content.context,
    image: item.image,
    itemId: item.id,
    skillId: item.skillId,
    visual: item.content.visual,
  };

  if (item.format === "trueFalse") {
    return { ...base, format: item.format, options: null, question: item.content.statement };
  }

  return {
    ...base,
    format: item.format,
    options: item.content.options.map((option) => option.text),
    question: item.content.question,
  };
}

export type QuestionView = ReturnType<typeof toQuestionView>;

/** The right answer in the shape the learner answers with, shown after grading. */
export function getChoiceCorrectAnswer(
  item: ChoiceItem,
): { isTrue: boolean } | { selectedIndex: number } {
  return item.format === "trueFalse"
    ? { isTrue: item.content.isTrue }
    : { selectedIndex: item.content.options.findIndex((option) => option.isCorrect) };
}

/** The question text, for how long reading it takes and for the notebook. */
export function getQuestionText(item: ChoiceItem): string {
  return item.format === "trueFalse" ? item.content.statement : item.content.question;
}

/** Whether a wrong answer is tagged with a misconception, which trap drills look for. */
export function hasMisconceptions(item: ChoiceItem): boolean {
  if (item.format === "trueFalse") {
    return Boolean(item.content.misconception);
  }

  return item.content.options.some((option) => !option.isCorrect && Boolean(option.misconception));
}

type GradedChoice = {
  dontKnow: boolean;
  isCorrect: boolean;
  /** What the notebook keeps when the answer is wrong. */
  snapshot: MistakeSnapshot;
};

function gradeTrueFalse({
  answer,
  item,
}: {
  answer: ChoiceAnswer;
  item: Extract<ChoiceItem, { format: "trueFalse" }>;
}): GradedChoice {
  const picked = "isTrue" in answer ? answer.isTrue : null;
  const isCorrect = picked === item.content.isTrue;

  return {
    dontKnow: "dontKnow" in answer,
    isCorrect,
    snapshot: {
      answer: picked === null ? null : String(picked),
      correctAnswer: String(item.content.isTrue),
      explanation: item.content.reason,
      format: item.format,
      misconception: isCorrect ? null : item.content.misconception,
      question: item.content.statement,
    },
  };
}

function gradeMultipleChoice({
  answer,
  item,
}: {
  answer: ChoiceAnswer;
  item: Extract<ChoiceItem, { format: "multipleChoice" }>;
}): GradedChoice {
  const chosen = "selectedIndex" in answer ? item.content.options[answer.selectedIndex] : undefined;

  return {
    dontKnow: "dontKnow" in answer,
    isCorrect: chosen?.isCorrect ?? false,
    snapshot: {
      answer: chosen?.text ?? null,
      correctAnswer: item.content.options.find((option) => option.isCorrect)?.text ?? null,
      explanation: chosen?.reason ?? null,
      format: item.format,
      misconception: chosen && !chosen.isCorrect ? chosen.misconception : null,
      question: item.content.question,
    },
  };
}

/**
 * Grades a choice answer. An option index past the list, or an answer shape for the other format,
 * counts as wrong, like any wrong pick.
 */
export function gradeChoiceAnswer({ answer, item }: { answer: ChoiceAnswer; item: ChoiceItem }) {
  return item.format === "trueFalse"
    ? gradeTrueFalse({ answer, item })
    : gradeMultipleChoice({ answer, item });
}

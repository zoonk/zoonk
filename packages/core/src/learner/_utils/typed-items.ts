import { matchTypedAnswer } from "@zoonk/ai/tasks/v2/grading/typed-answer-match";
import { type LessonVisual } from "@zoonk/ai/tasks/v2/visuals/schema";
import { type Item } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";
import { type ParsedItemContent, parseItemContent } from "../../library/items/item-content";
import { type ItemImage, toItemImage } from "../../library/items/item-image";
import { type MistakeSnapshot } from "../../mistakes/mistake-snapshot";
import { type BankItem } from "./choice-items";

type TypedContent = Extract<ParsedItemContent, { format: "typed" }>;

/** A typed question: answered in the learner's own words, a word or a sentence. */
export type TypedItem = Pick<Item, "id" | "language" | "skillId"> &
  TypedContent & { image: ItemImage | null };

/** A typed question as the learner sees it: never its key points or accepted answers. */
export type TypedQuestionView = {
  context: string | null;
  format: "typed";
  image: ItemImage | null;
  itemId: string;
  options: null;
  question: string;
  skillId: string;
  visual: LessonVisual | null;
};

/**
 * Reads a bank item as a typed question, or null when it isn't one. Stored content passed the
 * item checks, so a parse failure is logged and the item skipped instead of failing the learner.
 */
export function parseTypedItem(item: BankItem): TypedItem | null {
  if (item.format !== "typed") {
    return null;
  }

  try {
    const parsed = parseItemContent({ content: item.content, format: item.format });

    return parsed.format === "typed"
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

export function toTypedQuestionView(item: TypedItem): TypedQuestionView {
  return {
    context: item.content.context,
    format: item.format,
    image: item.image,
    itemId: item.id,
    options: null,
    question: item.content.question,
    skillId: item.skillId,
    visual: item.content.visual,
  };
}

/** The question as a model grading it reads it: with its support text, when it has one. */
export function getTypedQuestionText(item: TypedItem): string {
  const { context, question } = item.content;
  return context ? `${context}\n\n${question}` : question;
}

/** What the learner sees as the right answer: the first accepted wording, or the model answer. */
export function getTypedCorrectAnswer(item: TypedItem): string {
  return item.content.acceptedAnswers[0] ?? item.content.sampleAnswer;
}

/**
 * Whether code settles the answer: it's one of the accepted wordings, or one with a slip. A
 * rounded number isn't: a language goal's item may ask for the number heard, and an item doesn't
 * say which goal it serves.
 */
export function matchesAcceptedAnswer({ item, text }: { item: TypedItem; text: string }): boolean {
  const { kind } = matchTypedAnswer({
    acceptedAnswers: item.content.acceptedAnswers,
    answer: text,
  });

  return kind === "exact" || kind === "typo";
}

/** What the notebook keeps for a typed answer that missed. */
export function toTypedSnapshot({
  explanation,
  item,
  text,
}: {
  explanation: string | null;
  item: TypedItem;
  text: string | null;
}): MistakeSnapshot {
  return {
    answer: text,
    correctAnswer: getTypedCorrectAnswer(item),
    explanation,
    format: item.format,
    misconception: null,
    question: item.content.question,
  };
}

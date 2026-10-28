import { matchTypedAnswer } from "@zoonk/ai/tasks/v2/grading/typed-answer-match";
import { type LessonVisual } from "@zoonk/ai/tasks/v2/visuals/schema";
import { type Item } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";
import { type ParsedItemContent, parseItemContent } from "../../library/items/item-content";
import { type ItemImage, toItemImage } from "../../library/items/item-image";
import { type MistakeSnapshot } from "../../mistakes/mistake-snapshot";
import { type BankItem } from "./choice-items";

type TypedContent = Extract<ParsedItemContent, { format: "typed" }>;

export type TypedItem = Pick<Item, "id" | "language" | "skillId"> &
  TypedContent & { image: ItemImage | null };

/** Omits key points and accepted answers. */
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

/** Returns null for unsupported or invalid content; parse failures are logged. */
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

export function getTypedQuestionText(item: TypedItem): string {
  const { context, question } = item.content;
  return context ? `${context}\n\n${question}` : question;
}

export function getTypedCorrectAnswer(item: TypedItem): string {
  return item.content.acceptedAnswers[0] ?? item.content.sampleAnswer;
}

/** Rounded-number matches are excluded: a shared item may test the exact number heard in listening. */
export function matchesAcceptedAnswer({ item, text }: { item: TypedItem; text: string }): boolean {
  const { kind } = matchTypedAnswer({
    acceptedAnswers: item.content.acceptedAnswers,
    answer: text,
  });

  return kind === "exact" || kind === "typo";
}

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

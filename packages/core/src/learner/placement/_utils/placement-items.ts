import { type Item, type ItemFormat } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";
import { type ParsedItemContent, parseItemContent } from "../../../library/items/item-content";
import {
  type ChoiceItem,
  type QuestionView,
  parseChoiceItem,
  toQuestionView,
} from "../../_utils/choice-items";

/**
 * What placement asks: quick multiple choice and true or false for breadth, and typed answers,
 * graded one key point at a time, to confirm a skill a lucky guess could otherwise skip.
 */
export const PLACEMENT_ITEM_FORMATS = [
  "multipleChoice",
  "trueFalse",
  "typed",
] as const satisfies ItemFormat[];

type TypedContent = Extract<ParsedItemContent, { format: "typed" }>;

export type TypedItem = Pick<Item, "id" | "language" | "skillId"> & TypedContent;

export type PlacementItem = ChoiceItem | TypedItem;

type BankItem = Pick<Item, "content" | "format" | "id" | "language" | "skillId">;

/** A typed question as the learner sees it: never its key points or accepted answers. */
type TypedQuestionView = {
  context: string | null;
  format: "typed";
  itemId: string;
  options: null;
  question: string;
  skillId: string;
};

export type PlacementQuestionView = QuestionView | TypedQuestionView;

function parseTypedItem(item: BankItem): TypedItem | null {
  if (item.format !== "typed") {
    return null;
  }

  try {
    const parsed = parseItemContent({ content: item.content, format: item.format });

    return parsed.format === "typed"
      ? { ...parsed, id: item.id, language: item.language, skillId: item.skillId }
      : null;
  } catch (error) {
    logError(`Item ${item.id} has content that doesn't match its format.`, error);
    return null;
  }
}

/** Reads a bank item as a placement question, or null for formats placement doesn't ask. */
export function parsePlacementItem(item: BankItem): PlacementItem | null {
  return parseChoiceItem(item) ?? parseTypedItem(item);
}

export function toPlacementQuestionView(item: PlacementItem): PlacementQuestionView {
  if (item.format !== "typed") {
    return toQuestionView(item);
  }

  return {
    context: item.content.context,
    format: item.format,
    itemId: item.id,
    options: null,
    question: item.content.question,
    skillId: item.skillId,
  };
}

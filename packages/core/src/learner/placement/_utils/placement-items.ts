import { type LessonVisual } from "@zoonk/ai/tasks/v2/visuals/schema";
import { type Item, type ItemFormat } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";
import { type ParsedItemContent, parseItemContent } from "../../../library/items/item-content";
import { type ItemImage, toItemImage } from "../../../library/items/item-image";
import {
  type BankItem,
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

export type TypedItem = Pick<Item, "id" | "language" | "skillId"> &
  TypedContent & { image: ItemImage | null };

export type PlacementItem = ChoiceItem | TypedItem;

/** A typed question as the learner sees it: never its key points or accepted answers. */
type TypedQuestionView = {
  context: string | null;
  format: "typed";
  image: ItemImage | null;
  itemId: string;
  options: null;
  question: string;
  skillId: string;
  visual: LessonVisual | null;
};

export type PlacementQuestionView = QuestionView | TypedQuestionView;

function parseTypedItem(item: BankItem): TypedItem | null {
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
    image: item.image,
    itemId: item.id,
    options: null,
    question: item.content.question,
    skillId: item.skillId,
    visual: item.content.visual,
  };
}

type AudienceItem = { examBlueprintId: string | null; skillId: string };

/**
 * An exam goal's placement asks questions written for its exam: a skill that has some asks only
 * those. General questions stand in for a skill without them once nothing is being written for it
 * (`writingSkillIds`): while the run writes its exam's questions, placement waits for them, so they
 * are the fallback only when writing fails or never covered the skill. Goals without an exam ask
 * general questions as they are.
 */
export function preferExamItems<TItem extends AudienceItem>({
  examBlueprintId,
  items,
  writingSkillIds = new Set(),
}: {
  examBlueprintId: string | null;
  items: readonly TItem[];
  writingSkillIds?: ReadonlySet<string>;
}): TItem[] {
  if (!examBlueprintId) {
    return [...items];
  }

  const examSkillIds = new Set(
    items.filter((item) => item.examBlueprintId === examBlueprintId).map((item) => item.skillId),
  );

  return items.filter(
    (item) =>
      item.examBlueprintId === examBlueprintId ||
      (!examSkillIds.has(item.skillId) && !writingSkillIds.has(item.skillId)),
  );
}

import { type ItemFormat } from "@zoonk/db";
import {
  type BankItem,
  type ChoiceItem,
  type QuestionView,
  isSinglePick,
  parseChoiceItem,
  toQuestionView,
} from "../../_utils/choice-items";
import {
  type TypedItem,
  type TypedQuestionView,
  parseTypedItem,
  toTypedQuestionView,
} from "../../_utils/typed-items";

/**
 * What placement asks: quick multiple choice and true or false for breadth, and typed answers,
 * graded one key point at a time, to confirm a skill a lucky guess could otherwise skip.
 */
export const PLACEMENT_ITEM_FORMATS = [
  "multipleChoice",
  "trueFalse",
  "typed",
] as const satisfies ItemFormat[];

export type PlacementItem = ChoiceItem | TypedItem;

export type PlacementQuestionView = QuestionView | TypedQuestionView;

/**
 * Reads a bank item as a placement question, or null for one placement doesn't ask: other formats,
 * and questions that ask for several options, since placement asks one quick pick per skill.
 */
export function parsePlacementItem(item: BankItem): PlacementItem | null {
  const choice = parseChoiceItem(item);

  if (choice) {
    return isSinglePick(choice) ? choice : null;
  }

  return parseTypedItem(item);
}

export function toPlacementQuestionView(item: PlacementItem): PlacementQuestionView {
  return item.format === "typed" ? toTypedQuestionView(item) : toQuestionView(item);
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

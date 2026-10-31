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

export const PLACEMENT_ITEM_FORMATS = [
  "multipleChoice",
  "trueFalse",
  "typed",
] as const satisfies ItemFormat[];

export type PlacementItem = ChoiceItem | TypedItem;

export type PlacementQuestionView = QuestionView | TypedQuestionView;

/** Returns null for unsupported formats and multipick questions. */
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

/** General questions are a fallback only after matching exam-question generation ends or fails. */
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

import { type ItemFormat } from "@zoonk/db";
import { type MatchItem, toMatchQuestion } from "../../../sessions/_utils/match-items";
import { type OrderItem, toOrderQuestion } from "../../../sessions/_utils/order-items";
import { gradeSessionAnswer, parseSessionItem } from "../../../sessions/_utils/session-items";
import { type BankItem, type ChoiceItem, toQuestionView } from "../../_utils/choice-items";
import { isLowGuessTap, isQuickChoice } from "../../_utils/placement-guess-rate";
import { type PlacementAnswerInput } from "../placement-contract";

export const PLACEMENT_ITEM_FORMATS = [
  "multipleChoice",
  "trueFalse",
  "matchPairs",
  "order",
] as const satisfies ItemFormat[];

export type PlacementItem = ChoiceItem | MatchItem | OrderItem;

export function isPlacementItem(item: { content?: unknown; format: ItemFormat }): boolean {
  return item.format === "trueFalse" || isQuickChoice(item) || isLowGuessTap(item);
}

export function parsePlacementItem(item: BankItem): PlacementItem | null {
  if (!isPlacementItem(item)) {
    return null;
  }

  const parsed = parseSessionItem(item);

  return parsed?.format === "multipleChoice" ||
    parsed?.format === "trueFalse" ||
    parsed?.format === "matchPairs" ||
    parsed?.format === "order"
    ? parsed
    : null;
}

/** A placement question has no block, so it's shown and graded in a context of its own. @internal */
export function getPlacementBlockId(item: PlacementItem): string {
  return item.id;
}

export function toPlacementQuestionView(item: PlacementItem) {
  const blockId = getPlacementBlockId(item);

  if (item.format === "matchPairs") {
    return { ...toMatchQuestion({ blockId, item }), key: null };
  }

  return item.format === "order" ? toOrderQuestion({ blockId, item }) : toQuestionView(item);
}

export type PlacementQuestionView = ReturnType<typeof toPlacementQuestionView>;

export function gradePlacementAnswer({
  answer,
  item,
}: {
  answer: PlacementAnswerInput["answer"];
  item: PlacementItem;
}) {
  return gradeSessionAnswer({ answer, blockId: getPlacementBlockId(item), item });
}

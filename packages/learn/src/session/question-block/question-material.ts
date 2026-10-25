import { type ItemSetView } from "@zoonk/core/library/items/set-view";
import { isLongText } from "../../questions/long-text";

/** What a question is read with beside it: the stimulus its set shares. */
export type QuestionMaterialKind = ItemSetView["kind"];

/**
 * What a question is read with beside it from `lg`: the set it's on (a text, a case, a chart or a
 * recording), shared with the set's other questions; null for a question on its own, whose context,
 * picture or chart stays above it in the column. `long` widens the aside to a second column.
 */
export function getQuestionMaterial(question: {
  set: Pick<ItemSetView, "kind" | "listening" | "text"> | null;
}): { kind: QuestionMaterialKind; long: boolean } | null {
  const { set } = question;

  if (!set) {
    return null;
  }

  return set.listening
    ? { kind: "audio", long: false }
    : { kind: set.kind, long: isLongText(set.text) };
}

import { type ItemSetView } from "@zoonk/core/library/items/set-view";

/**
 * A shared text this long is read beside its question at half the screen from `lg`: about where a
 * phone starts folding it (`ItemSetStimulus`).
 */
const LONG_TEXT_CHARACTERS = 400;

/** What a question is read with beside it: the stimulus its set shares. */
export type QuestionMaterialKind = ItemSetView["kind"];

/**
 * What a question is read with beside it from `lg`: the set it's on (a text, a case, a chart or a
 * recording), shared with the set's other questions; null for a question on its own, whose context,
 * picture or chart stays above it in the column. `long` widens the aside to half.
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
    : { kind: set.kind, long: (set.text ?? "").length >= LONG_TEXT_CHARACTERS };
}

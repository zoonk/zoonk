import { type ItemSetView } from "@zoonk/core/library/items/set-view";
import { isLongText } from "../../questions/long-text";

export type QuestionMaterialKind = ItemSetView["kind"];

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

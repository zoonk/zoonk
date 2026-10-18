import { type ItemSetView } from "@zoonk/core/library/items/set-view";

/**
 * A shared text this long is read beside its question at half the screen from `lg`: about where a
 * phone starts folding it (`ItemSetStimulus`).
 */
const LONG_TEXT_CHARACTERS = 400;

/** What a question is read with: its set's stimulus, or its own text or figure. */
export type QuestionMaterialKind = ItemSetView["kind"] | "figure";

/**
 * What the question shows before its command, which the aside holds from `lg`: the set it's on (a
 * text, a case, a chart or a recording), else its own context (a text) or picture and chart (a
 * figure); null for a question with nothing to read first. `long` widens the aside to half.
 */
export function getQuestionMaterial(question: {
  context: string | null;
  image: unknown;
  set: Pick<ItemSetView, "kind" | "listening" | "text"> | null;
  visual: unknown;
}): { kind: QuestionMaterialKind; long: boolean } | null {
  const { context, image, set, visual } = question;
  const text = (set?.listening ? null : set?.text) ?? context ?? "";
  const long = text.length >= LONG_TEXT_CHARACTERS;

  if (set) {
    return { kind: set.listening ? "audio" : set.kind, long };
  }

  if (context) {
    return { kind: "text", long };
  }

  return image || visual ? { kind: "figure", long: false } : null;
}

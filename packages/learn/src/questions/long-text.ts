/**
 * A text this long is read beside what it's for from `lg` (a set's shared text beside its
 * questions, an essay's texts beside the box): about where a phone starts folding it
 * (`ItemSetStimulus`).
 */
const LONG_TEXT_CHARACTERS = 400;

/** Whether a text is long enough to read beside its question, rather than over it. */
export function isLongText(text: string | null): boolean {
  return (text ?? "").length >= LONG_TEXT_CHARACTERS;
}

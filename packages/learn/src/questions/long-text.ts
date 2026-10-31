/** About where a phone starts folding a set's text (`ItemSetStimulus`). */
const LONG_TEXT_CHARACTERS = 400;

export function isLongText(text: string | null): boolean {
  return (text ?? "").length >= LONG_TEXT_CHARACTERS;
}

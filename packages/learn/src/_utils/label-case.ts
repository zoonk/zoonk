/**
 * A name written to read inside a sentence ("quantum physics", an exam area in lowercase) shown
 * on its own, as a chip or a tile, starts with a capital letter.
 */
export function toLabelCase(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

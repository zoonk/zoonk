/**
 * The lesson moves between screens with the arrow keys. A focused activity control keeps them,
 * so moving along piano keys or word tiles never leaves the screen. (Enter on a control already
 * presses it instead of checking: see `use-lesson-keyboard.ts`.)
 */
export function keepArrowKeys(event: React.KeyboardEvent): void {
  if (event.key.startsWith("Arrow")) {
    event.stopPropagation();
  }
}

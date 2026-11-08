export type ReadyHold = "go" | "hold" | "wait";

/**
 * Once what the learner waits for is ready, one who guessed on this screen stays until they press
 * the main button. Anyone else moves on as before, once a second passed without a touch, so a tap
 * on its way lands on the card and not on what the next screen puts under the finger; a guess in
 * that second counts as playing.
 */
export function getReadyHold({
  guessed,
  ready,
  released,
  touched,
}: {
  /** The learner guessed on this screen. */
  guessed: boolean;
  ready: boolean;
  /** The learner pressed the main button. */
  released: boolean;
  /** The screen was touched in the last second. */
  touched: boolean;
}): ReadyHold {
  if (!ready) {
    return "wait";
  }

  if (released) {
    return "go";
  }

  if (guessed) {
    return "hold";
  }

  return touched ? "wait" : "go";
}

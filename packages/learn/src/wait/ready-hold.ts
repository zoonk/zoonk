export type ReadyHold = "go" | "hold" | "wait";

/**
 * Once what the learner waits for is ready, one who played or watched on this screen stays until
 * they press the main button. Anyone else moves on as before, once a second passed without a
 * touch, so a tap on its way lands on the screen and not on what the next screen puts under the
 * finger; playing in that second counts.
 */
export function getReadyHold({
  engaged,
  ready,
  released,
  touched,
}: {
  /** The learner guessed, opened the progress or chose the quiz on this screen. */
  engaged: boolean;
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

  if (engaged) {
    return "hold";
  }

  return touched ? "wait" : "go";
}

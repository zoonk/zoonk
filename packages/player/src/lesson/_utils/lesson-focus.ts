/** The lesson's scrolling content area. */
export const LESSON_CONTENT_ID = "lesson-content";

/** The screen's main action (Next, Check, Continue). */
export const LESSON_PRIMARY_ID = "lesson-primary-action";

/**
 * Where focus goes when a menu, a sheet or a dialog over the lesson closes: the screen's main
 * action, not the button that opened it, so Enter goes on with the lesson instead of opening it
 * again. While the main action waits for an answer, the screen's first control (an option, the
 * answer field) takes it.
 */
export function getLessonFocusTarget(): HTMLElement | null {
  const primary = document.querySelector(`#${LESSON_PRIMARY_ID}`);

  if (primary instanceof HTMLButtonElement && !primary.disabled) {
    return primary;
  }

  return document.querySelector(`#${LESSON_CONTENT_ID}`);
}

/**
 * Keeps focus in the lesson after a control on the screen turns it (Explain first, Can't write
 * now): the control leaves with its screen, so focus would fall back to the page. It goes where
 * it goes after a sheet closes (`getLessonFocusTarget`), once the next screen is in.
 */
export function focusLessonAfterTurn(): void {
  requestAnimationFrame(() => getLessonFocusTarget()?.focus({ preventScroll: true }));
}

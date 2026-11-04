export const LESSON_CONTENT_ID = "lesson-content";

export const LESSON_PRIMARY_ID = "lesson-primary-action";

export function getReadyLessonPrimary(): HTMLButtonElement | null {
  const primary = document.querySelector(`#${LESSON_PRIMARY_ID}`);
  return primary instanceof HTMLButtonElement &&
    !primary.matches(":disabled, [aria-disabled='true']")
    ? primary
    : null;
}

export function getLessonFocusTarget(): HTMLElement | null {
  return getReadyLessonPrimary() ?? document.querySelector(`#${LESSON_CONTENT_ID}`);
}

export function focusLessonAfterTurn(): void {
  requestAnimationFrame(() => getLessonFocusTarget()?.focus({ preventScroll: true }));
}

export const LESSON_CONTENT_ID = "lesson-content";

export const LESSON_PRIMARY_ID = "lesson-primary-action";

export function getLessonFocusTarget(): HTMLElement | null {
  const primary = document.querySelector(`#${LESSON_PRIMARY_ID}`);

  if (primary instanceof HTMLButtonElement && !primary.disabled) {
    return primary;
  }

  return document.querySelector(`#${LESSON_CONTENT_ID}`);
}

export function focusLessonAfterTurn(): void {
  requestAnimationFrame(() => getLessonFocusTarget()?.focus({ preventScroll: true }));
}

import { type MouseEvent } from "react";
import { flushSync } from "react-dom";

type Press = MouseEvent<HTMLButtonElement>;

export const LESSON_CONTENT_ID = "lesson-content";

export const LESSON_PRIMARY_ID = "lesson-primary-action";

export const LESSON_BACK_ID = "lesson-back-action";

function isRendered(element: Element): boolean {
  return element.getClientRects().length > 0;
}

/** A screen the learner leaves unfinished stays mounted, hidden, with its action bar until React renders it again. */
function getShown(id: string): HTMLElement | null {
  const elements = document.querySelectorAll<HTMLElement>(`#${id}`);
  return [...elements].find((element) => isRendered(element)) ?? null;
}

export function getReadyLessonPrimary(): HTMLButtonElement | null {
  const primary = getShown(LESSON_PRIMARY_ID);

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

/** A screen reader's click in Chromium keeps its button pressed, which a tap or click has already released: https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/core/events/simulated_event_util.cc */
function isVirtualPress({ nativeEvent }: Press): boolean {
  if (nativeEvent instanceof PointerEvent) {
    return nativeEvent.pointerType === "" || nativeEvent.buttons === 1;
  }

  return nativeEvent.detail === 0;
}

function updateThenFocus(update: () => void, getTarget: () => HTMLElement | null | undefined) {
  flushSync(update);
  getTarget()?.focus({ preventScroll: true });
}

/** A tap or click leaves focus where the browser puts it, so Enter afterwards still runs the screen's main action. */
export function updateKeepingFocus(
  event: Press,
  update: () => void,
  getTarget: () => HTMLElement | null | undefined,
) {
  if (isVirtualPress(event)) {
    updateThenFocus(update, getTarget);
    return;
  }

  update();
}

/** Each screen has its own action bar, so a turn takes away the control that had focus. */
function getFocusAfterTurn(controlId: string): HTMLElement | null {
  const focused = document.activeElement;

  if (focused && focused !== document.body && isRendered(focused)) {
    return null;
  }

  const back = controlId === LESSON_BACK_ID ? getShown(LESSON_BACK_ID) : null;
  const primary = getShown(LESSON_PRIMARY_ID);
  const focusable = primary && !primary.matches(":disabled") ? primary : null;

  return back ?? focusable ?? document.querySelector(`#${LESSON_CONTENT_ID}`);
}

export function pressKeepingFocus(event: Press, press: () => void): void {
  const { id } = event.currentTarget;
  updateKeepingFocus(event, press, () => getFocusAfterTurn(id));
}

export function turnKeepingFocus(turn: () => void): void {
  const id = document.activeElement?.id ?? "";

  if (id === LESSON_BACK_ID || id === LESSON_PRIMARY_ID) {
    updateThenFocus(turn, () => getFocusAfterTurn(id));
    return;
  }

  turn();
}

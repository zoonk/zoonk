import { type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { getReadyLessonPrimary } from "../../lesson/_utils/lesson-focus";

type Press = MouseEvent<HTMLButtonElement>;

const BANK_SELECTOR = "[data-slot='word-bank']";
const ANSWER_SELECTOR = "[data-slot='word-answer']";

function getButtons(container: Element | null): HTMLButtonElement[] {
  return [...(container?.querySelectorAll("button") ?? [])];
}

function isAvailable(button: HTMLButtonElement): boolean {
  return button.isConnected && !button.disabled;
}

function getNearestAvailable(buttons: HTMLButtonElement[], pressed: HTMLButtonElement) {
  const index = buttons.indexOf(pressed);

  return (
    buttons.slice(index + 1).find((button) => isAvailable(button)) ??
    buttons.slice(0, index).findLast((button) => isAvailable(button))
  );
}

/** A screen reader's click in Chromium keeps its button pressed, which a tap or click has already released: https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/core/events/simulated_event_util.cc */
function isVirtualPress({ nativeEvent }: Press): boolean {
  if (nativeEvent instanceof PointerEvent) {
    return nativeEvent.pointerType === "" || nativeEvent.buttons === 1;
  }

  return nativeEvent.detail === 0;
}

/** A tap or click leaves focus where the browser puts it, so Enter afterwards still checks the answer. */
function updateKeepingFocus(
  event: Press,
  update: () => void,
  getTarget: () => HTMLElement | null | undefined,
) {
  if (!isVirtualPress(event)) {
    update();
    return;
  }

  flushSync(update);
  getTarget()?.focus({ preventScroll: true });
}

export function placeKeepingFocus(event: Press, place: () => void) {
  const tile = event.currentTarget;
  const tiles = getButtons(tile.closest(BANK_SELECTOR));

  updateKeepingFocus(
    event,
    place,
    () => getReadyLessonPrimary() ?? getNearestAvailable(tiles, tile),
  );
}

export function removeKeepingFocus(event: Press, remove: () => void) {
  const word = event.currentTarget;
  const words = getButtons(word.closest(ANSWER_SELECTOR));

  const usedTiles = getButtons(document.querySelector(BANK_SELECTOR)).filter(
    (tile) => tile.disabled,
  );

  updateKeepingFocus(
    event,
    remove,
    () => getNearestAvailable(words, word) ?? usedTiles.find((tile) => isAvailable(tile)),
  );
}

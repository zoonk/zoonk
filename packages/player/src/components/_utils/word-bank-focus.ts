import { type MouseEvent } from "react";
import { getReadyLessonPrimary, updateKeepingFocus } from "../../lesson/_utils/lesson-focus";

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

export function placeKeepingFocus({
  event,
  fillsAnswer,
  place,
}: {
  event: Press;
  fillsAnswer: boolean;
  place: () => void;
}) {
  const tile = event.currentTarget;
  const tiles = getButtons(tile.closest(BANK_SELECTOR));

  updateKeepingFocus(
    event,
    place,
    () => (fillsAnswer ? getReadyLessonPrimary() : null) ?? getNearestAvailable(tiles, tile),
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

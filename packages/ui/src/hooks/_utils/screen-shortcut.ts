import { canScrollAlong } from "@zoonk/ui/lib/scroll-overflow";

const MAX_NUMBER_KEY = 9;

export const POPUP_SELECTOR =
  "[role='dialog'], [role='alertdialog'], [role='menu'], [role='listbox']";

export const SCREEN_ENTER_ATTRIBUTE = "data-screen-enter";

/** A radio isn't one: Enter on a picked answer submits it, as a radio does in a form. Nor is a button with its own key, such as audio's P. */
const PRESSABLE_SELECTOR = [
  "a[href]",
  `button:not([role='radio'], [${SCREEN_ENTER_ATTRIBUTE}])`,
  "summary",
  "[role='button']",
  "[role='checkbox']",
  "[role='link']",
  "[role^='menuitem']",
  "[role='option']",
  "[role='switch']",
  "[role='tab']",
].join(", ");

function isEditableTarget(target: EventTarget | null): boolean {
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return true;
  }

  return target instanceof HTMLElement && target.isContentEditable;
}

/**
 * Enter does nothing in a select, a read-only field or a one-line field outside a form, so there it
 * runs the screen's main action.
 */
function isEnterFree(target: EventTarget | null): boolean {
  if (target instanceof HTMLSelectElement) {
    return true;
  }

  if (target instanceof HTMLTextAreaElement) {
    return target.readOnly;
  }

  return target instanceof HTMLInputElement && (target.readOnly || target.form === null);
}

function shortcutTarget(event: KeyboardEvent): Element | null {
  return event.target instanceof Element ? event.target : document.activeElement;
}

function isKeptByField(event: KeyboardEvent): boolean {
  const target = shortcutTarget(event);

  if (!isEditableTarget(target)) {
    return false;
  }

  return !(event.key === "Enter" && isEnterFree(target));
}

/**
 * A radio stops Enter from toggling it, yet Enter on a picked answer still goes on, as in a form. A
 * button that keeps focus while it waits (`focusableWhenDisabled`) stops every key but Tab without
 * handling any, so Escape still leaves the screen.
 */
function isHandledByControl(event: KeyboardEvent): boolean {
  if (!event.defaultPrevented) {
    return false;
  }

  const target = event.target instanceof Element ? event.target : null;

  if (target?.matches("button[aria-disabled='true']")) {
    return false;
  }

  const isRadio = target?.closest("[role='radio']");
  return !(event.key === "Enter" && isRadio);
}

function scrollsToward(element: Element | null, arrow: string): boolean {
  return (
    element !== null &&
    canScrollAlong(element, arrow === "ArrowLeft" || arrow === "ArrowRight" ? "x" : "y")
  );
}

/** A held key acts once, so holding Enter never skips screens. */
export function isScreenShortcut(
  event: KeyboardEvent,
  { inPopup = false }: { inPopup?: boolean } = {},
): boolean {
  if (isHandledByControl(event) || event.repeat || isKeptByField(event)) {
    return false;
  }

  const element = shortcutTarget(event);

  // A focusable region, or a focused element with more to show that way, keeps arrows for native scrolling.
  if (
    event.key.startsWith("Arrow") &&
    (element?.closest("[role='region'][tabindex='0']") || scrollsToward(element, event.key))
  ) {
    return false;
  }

  const isInPopup = element !== null && element.closest(POPUP_SELECTOR) !== null;

  if (isInPopup !== inPopup) {
    return false;
  }

  return !(event.key === "Enter" && element?.closest(PRESSABLE_SELECTOR));
}

export function getNumberKeyIndex(event: KeyboardEvent): number | null {
  if (event.altKey || event.ctrlKey || event.metaKey) {
    return null;
  }

  const number = Number(event.key);

  return Number.isInteger(number) && number >= 1 && number <= MAX_NUMBER_KEY ? number - 1 : null;
}

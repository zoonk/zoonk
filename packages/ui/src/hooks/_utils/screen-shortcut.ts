/** Number keys reach nine options: there's no key for a tenth. */
const MAX_NUMBER_KEY = 9;

/** A dialog or a menu open over the screen owns the keys pressed inside it. */
const POPUP_SELECTOR = "[role='dialog'], [role='alertdialog'], [role='menu'], [role='listbox']";

/**
 * Controls that act on Enter themselves. A radio isn't one: Enter on a picked answer submits it,
 * as a radio does in a form.
 */
const PRESSABLE_SELECTOR = [
  "a[href]",
  "button:not([role='radio'])",
  "summary",
  "[role='button']",
  "[role='checkbox']",
  "[role='link']",
  "[role^='menuitem']",
  "[role='option']",
  "[role='switch']",
  "[role='tab']",
].join(", ");

/** Typing belongs to the field: inputs, text areas, selects and editable content. */
export function isEditableTarget(target: EventTarget | null): boolean {
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
 * Enter means nothing in a select, or in a one-line field outside a form (where it would submit
 * the form), so there it runs the screen's main action, such as checking a typed number.
 */
function isEnterFree(target: EventTarget | null): boolean {
  if (target instanceof HTMLSelectElement) {
    return true;
  }

  return target instanceof HTMLInputElement && target.form === null;
}

/** Fields keep their keys, apart from an Enter they have no use for. */
function isKeptByField(event: KeyboardEvent): boolean {
  if (!isEditableTarget(event.target)) {
    return false;
  }

  return !(event.key === "Enter" && isEnterFree(event.target));
}

/**
 * A control that handled the key itself (a slider's arrow, a menu's Enter) keeps it. A radio stops
 * Enter from toggling it, yet Enter on a picked answer still goes on, as in a form.
 */
function isHandledByControl(event: KeyboardEvent): boolean {
  if (!event.defaultPrevented) {
    return false;
  }

  const isRadio = event.target instanceof Element && event.target.closest("[role='radio']");
  return !(event.key === "Enter" && isRadio);
}

/**
 * Whether a key press is for the screen's own shortcuts (Enter continues, numbers answer, arrows
 * move) rather than for the control in focus. The control keeps a key it already handled (a
 * slider's arrow, a radio's Enter), typing in a field and Enter on a button or a link. A dialog or
 * a menu keeps the keys pressed inside it, and a dialog's own shortcut (`inPopup`) only takes keys
 * pressed there. A held key acts once, so holding Enter never skips screens.
 */
export function isScreenShortcut(
  event: KeyboardEvent,
  { inPopup = false }: { inPopup?: boolean } = {},
): boolean {
  if (isHandledByControl(event) || event.repeat || isKeptByField(event)) {
    return false;
  }

  const element = event.target instanceof Element ? event.target : null;
  const isInPopup = element !== null && element.closest(POPUP_SELECTOR) !== null;

  if (isInPopup !== inPopup) {
    return false;
  }

  return !(event.key === "Enter" && element?.closest(PRESSABLE_SELECTOR));
}

/** The option a number key picks (0 for "1"), or null for any other key or a shortcut chord. */
export function getNumberKeyIndex(event: KeyboardEvent): number | null {
  if (event.altKey || event.ctrlKey || event.metaKey) {
    return null;
  }

  const number = Number(event.key);

  return Number.isInteger(number) && number >= 1 && number <= MAX_NUMBER_KEY ? number - 1 : null;
}

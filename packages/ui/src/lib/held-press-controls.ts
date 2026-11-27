export const HELD_PRESS_ROLES = [
  "button",
  "switch",
  "checkbox",
  "radio",
  "tab",
  "menuitem",
  "option",
];
export const HELD_PRESS_TAG = "button";
export const HELD_PRESS_INPUT_TYPE = "submit";

export const HELD_PRESS_SELECTOR = [
  HELD_PRESS_TAG,
  `input[type=${HELD_PRESS_INPUT_TYPE}]`,
  ...HELD_PRESS_ROLES.map((role) => `[role=${role}]`),
].join(", ");

/** `data-held-ask="microphone"` on a control whose press asks for the microphone. */
export const HELD_ASK_ATTRIBUTE = "data-held-ask";

/**
 * On a form whose submit loads its action's page, before the page hydrates and after: the browser
 * sends it at once, and its button stays held until a back/forward restore shows this page again.
 */
export const OPENS_PAGE_ATTRIBUTE = "data-opens-page";

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

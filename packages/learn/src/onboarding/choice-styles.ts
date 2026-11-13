/** An inset shadow, so the keyboard's focus ring still shows over it. */
export const CHOICE_PICKED_ROW_CLASS =
  "data-highlighted:before:bg-selected-tint data-highlighted:hover:before:bg-selected-tint data-highlighted:before:shadow-[inset_0_0_0_2px_var(--color-selected)]";

/** One 2 px stroke over the card's own line: a border plus a shadow leaves a lighter seam at the corners. */
export const CHOICE_CARD_PICKED_CLASS =
  "has-data-checked:border-transparent has-data-checked:bg-selected-tint has-data-checked:outline-2 has-data-checked:-outline-offset-2 has-data-checked:outline-selected has-data-checked:outline-solid";

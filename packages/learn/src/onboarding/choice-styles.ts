/**
 * A choice's radio or checkbox at its row's end, drawn as every list marks what's done: an empty
 * ring, filled in the text color with a check once picked (`data-checked`). The ring at rest is a
 * step firmer than a field's line: at 20px the input's line all but vanished on a dark page. The
 * row is its label, so a tap anywhere on it picks it. In a module of its own so the public pages
 * draw a picked choice too.
 */
export const CHOICE_CONTROL_CLASS =
  "border-foreground/25 contrast-more:border-input data-checked:border-selected data-checked:bg-selected dark:data-checked:bg-selected data-checked:text-selected-foreground size-5 self-center rounded-full border-[1.5px] dark:bg-transparent [&_svg]:size-3";

/**
 * The picked choice's row (`data-highlighted`) as every pick is drawn: the learner's 2px line
 * on its tint, not the neutral fill of a list's current row (that's a place, not a pick). An inset
 * shadow, so the keyboard's focus ring still shows over it. Shared with the public pages' example.
 */
export const CHOICE_PICKED_ROW_CLASS =
  "data-highlighted:before:bg-selected-tint data-highlighted:hover:before:bg-selected-tint data-highlighted:before:shadow-[inset_0_0_0_2px_var(--color-selected)]";

/**
 * A bordered option card once its radio is checked: the border takes the text color and an inset
 * line makes it 2px, on the pick's tint, so a card pick reads like every other pick.
 */
export const CHOICE_CARD_PICKED_CLASS =
  "has-data-checked:border-selected has-data-checked:bg-selected-tint has-data-checked:shadow-[inset_0_0_0_1px_var(--color-selected)]";

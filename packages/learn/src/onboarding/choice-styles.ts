/** In a module of its own so the public pages draw a picked choice too. */
export const CHOICE_CONTROL_CLASS =
  "border-foreground/25 contrast-more:border-input data-checked:border-selected data-checked:bg-selected dark:data-checked:bg-selected data-checked:text-selected-foreground size-5 self-center rounded-full border-[1.5px] dark:bg-transparent [&_svg]:size-3";

/** An inset shadow, so the keyboard's focus ring still shows over it. */
export const CHOICE_PICKED_ROW_CLASS =
  "data-highlighted:before:bg-selected-tint data-highlighted:hover:before:bg-selected-tint data-highlighted:before:shadow-[inset_0_0_0_2px_var(--color-selected)]";

export const CHOICE_CARD_PICKED_CLASS =
  "has-data-checked:border-selected has-data-checked:bg-selected-tint has-data-checked:shadow-[inset_0_0_0_1px_var(--color-selected)]";

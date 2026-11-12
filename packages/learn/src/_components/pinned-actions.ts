/**
 * Sticks to the bottom while a long screen scrolls under it and rests in place on a short one. Its
 * fade covers the 24px gap above it, so it only shows over content. Add its `bottom` offset.
 */
export const PINNED_ACTIONS_CLASS =
  "bg-background sticky z-10 -mx-4 px-4 before:from-background before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-6 before:bg-linear-to-t before:to-transparent";

/** Focus scrolls what it reaches clear of the pinned actions. */
export const CLEAR_OF_PINNED_ACTIONS_CLASS = "[&_*]:scroll-mb-40";

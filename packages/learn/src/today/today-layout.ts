import { cn } from "@zoonk/ui/lib/utils";
import { ABOVE_BOTTOM_TABS_CLASS } from "../shell/learn-navigation";

/** On a phone, focus scrolls what it reaches clear of the tab bar, the docked action and its fade. */
const CLEAR_OF_DOCK_CLASS =
  "max-sm:[&_*]:scroll-mb-[calc(4rem+1px+env(safe-area-inset-bottom)+4.25rem+1.5rem)]";

export const TODAY_MAIN_CLASS = cn(
  "grid grid-cols-1 [grid-template-areas:'head'_'session'_'action'_'more'] sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-6 sm:[grid-template-areas:'head_action'_'session_session'_'more_more']",
  CLEAR_OF_DOCK_CLASS,
);

/** On a phone the page ends with room for the action docked over it. */
export const TODAY_ASIDE_CLASS = cn(
  "max-sm:pb-17 sm:grid sm:grid-cols-2 sm:gap-x-10 sm:gap-y-8 min-[72rem]:flex min-[72rem]:gap-8",
  CLEAR_OF_DOCK_CLASS,
);

export const TODAY_ACTION_CLASS = cn(
  "[grid-area:action] sm:self-end",
  "max-sm:bg-background max-sm:fixed max-sm:inset-x-0 max-sm:z-20 max-sm:px-4 max-sm:pt-3 max-sm:pb-3",
  // Only docked on a phone, so its offset does nothing from `sm`.
  ABOVE_BOTTOM_TABS_CLASS,
  "max-sm:before:from-background max-sm:before:pointer-events-none max-sm:before:absolute max-sm:before:inset-x-0 max-sm:before:bottom-full max-sm:before:h-6 max-sm:before:bg-linear-to-t max-sm:before:to-transparent",
);

/**
 * Marked `data-speaking` while it says something. A docked bar grows upward, so on a phone the line
 * goes above the button and the button stays under the learner's thumb.
 */
export const TODAY_ACTION_STATUS_CLASS =
  "text-sm max-sm:order-first max-sm:data-speaking:pb-2 sm:data-speaking:pt-2";

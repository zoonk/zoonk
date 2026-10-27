import { cn } from "@zoonk/ui/lib/utils";
import { ABOVE_BOTTOM_TABS_CLASS } from "../shell/learn-navigation";

/**
 * Today's column: its title row (the day's action beside the title from `sm`), then the session,
 * then what else the day offers. On a phone the action follows the queue, in thumb reach, so
 * there's one button (and one Enter) on every screen (`TODAY_ACTION_CLASS`). Its loading shape
 * uses it too.
 */
export const TODAY_MAIN_CLASS =
  "grid grid-cols-1 [grid-template-areas:'head'_'session'_'action'_'more'] sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-6 sm:[grid-template-areas:'head_action'_'session_session'_'more_more']";

/**
 * Today's aside: the notice first under 72rem, right under the day, then the week and the rest,
 * two up from `sm`. From 72rem it's the full-height aside, where the notice follows the week and
 * the preparation.
 */
export const TODAY_ASIDE_CLASS =
  "sm:grid sm:grid-cols-2 sm:gap-x-10 sm:gap-y-8 min-[72rem]:flex min-[72rem]:gap-8";

/**
 * The day's action. From `sm` it sits beside the title. On a phone it follows the queue in the
 * day's order but docks above the tab bar while the queue runs past the screen, so it's in thumb
 * reach on the first screen however long the day is, and settles under the queue once the learner
 * scrolls there. Its band covers the rows passing under it, fading in above the button so they
 * don't end on a hard edge.
 */
export const TODAY_ACTION_CLASS = cn(
  "mt-1 [grid-area:action] sm:mt-0 sm:self-end",
  "max-sm:bg-background max-sm:sticky max-sm:z-20 max-sm:-mx-4 max-sm:px-4 max-sm:pt-3 max-sm:pb-3",
  // Only sticky on a phone, so its offset does nothing from `sm`.
  ABOVE_BOTTOM_TABS_CLASS,
  "max-sm:before:from-background max-sm:before:pointer-events-none max-sm:before:absolute max-sm:before:inset-x-0 max-sm:before:bottom-full max-sm:before:h-6 max-sm:before:bg-linear-to-t max-sm:before:to-transparent",
);

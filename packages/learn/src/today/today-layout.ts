/**
 * Today's column: its title row (the day's action beside the title from `sm`), then the session,
 * then what else the day offers. On a phone the action sits under the queue, in thumb reach, so
 * there's one button (and one Enter) on every screen. Its loading shape uses it too.
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

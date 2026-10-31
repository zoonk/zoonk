import { cn } from "@zoonk/ui/lib/utils";
import { ABOVE_BOTTOM_TABS_CLASS } from "../shell/learn-navigation";

export const TODAY_MAIN_CLASS =
  "grid grid-cols-1 [grid-template-areas:'head'_'session'_'action'_'more'] sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-6 sm:[grid-template-areas:'head_action'_'session_session'_'more_more']";

export const TODAY_ASIDE_CLASS =
  "sm:grid sm:grid-cols-2 sm:gap-x-10 sm:gap-y-8 min-[72rem]:flex min-[72rem]:gap-8";

export const TODAY_ACTION_CLASS = cn(
  "mt-1 [grid-area:action] sm:mt-0 sm:self-end",
  "max-sm:bg-background max-sm:sticky max-sm:z-20 max-sm:-mx-4 max-sm:px-4 max-sm:pt-3 max-sm:pb-3",
  // Only sticky on a phone, so its offset does nothing from `sm`.
  ABOVE_BOTTOM_TABS_CLASS,
  "max-sm:before:from-background max-sm:before:pointer-events-none max-sm:before:absolute max-sm:before:inset-x-0 max-sm:before:bottom-full max-sm:before:h-6 max-sm:before:bg-linear-to-t max-sm:before:to-transparent",
);

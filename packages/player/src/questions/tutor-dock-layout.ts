"use client";

import { TASK_ASIDE_PLACE_CLASS } from "@zoonk/learn/task-layout";
import { cn } from "@zoonk/ui/lib/utils";

/**
 * The buddy at the foot of a task's aside from `lg`: its composer in the action bar's row, under
 * the aside, with its suggestions just above the bar's hairline.
 */
export const TUTOR_DOCK_CLASS = cn("flex flex-col lg:bottom-0", TASK_ASIDE_PLACE_CLASS);

/** The dock's composer row, on the action bar's hairline. */
export const TUTOR_DOCK_BAR_CLASS =
  "border-border bg-background border-t px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]";

/**
 * The conversation docked over the aside's content from `lg`, above the dock: from under the
 * header's row, like the aside, so the header's menu stays in the window's corner.
 */
export const DOCKED_CONVERSATION_CLASS = cn(
  "bg-background hidden lg:top-(--task-bar) lg:bottom-(--task-aside-bottom) lg:z-40 lg:flex lg:flex-col",
  TASK_ASIDE_PLACE_CLASS,
);

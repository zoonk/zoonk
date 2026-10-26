"use client";

import { TASK_ASIDE_PLACE_CLASS } from "@zoonk/learn/task-layout";
import { cn } from "@zoonk/ui/lib/utils";

/**
 * The buddy at the foot of a task's aside from `lg`: its composer level with the action bar, with
 * its suggestions just above it.
 */
export const TUTOR_DOCK_CLASS = cn("flex flex-col lg:bottom-0", TASK_ASIDE_PLACE_CLASS);

/** The dock's composer row, level with the action bar's. */
export const TUTOR_DOCK_BAR_CLASS =
  "bg-background px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]";

/**
 * The conversation docked over the aside's content from `lg`, above the dock: from the aside's top,
 * its own header row in place of the aside's, level with the task's.
 */
export const DOCKED_CONVERSATION_CLASS = cn(
  "bg-background hidden lg:top-0 lg:bottom-(--task-aside-bottom) lg:z-40 lg:flex lg:flex-col",
  TASK_ASIDE_PLACE_CLASS,
);

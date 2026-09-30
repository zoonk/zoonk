/**
 * The four places of the learning experience. Both modes link to the same
 * routes; only their names and order change.
 */
export type LearnTab = "today" | "plan" | "progress" | "content";

/** Focus: Today, Plan, Progress and Content. */
export const FOCUS_TABS: readonly LearnTab[] = ["today", "plan", "progress", "content"];

/**
 * Fun's dock: Today, Route (the plan), Cards (the content) and the buddy, whose
 * page holds Fun's progress: the buddy, the logbook and the week.
 */
export const FUN_DOCK_TABS: readonly LearnTab[] = ["today", "plan", "content", "progress"];

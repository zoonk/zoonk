import { type ContentAnalytics } from "../_shared/content-analytics";

/** Who a goal's run writes for and the run itself, passed to every step it calls. */
export type GoalRunContext = { analytics: ContentAnalytics; workflowRunId: string };

/** A slice of the skill graph's skills being saved: their Library ids by graph key. */
export type SavedSlice = Promise<Record<string, string>>;

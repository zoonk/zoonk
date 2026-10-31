import { type ContentAnalytics } from "../_shared/content-analytics";

export type GoalRunContext = { analytics: ContentAnalytics; workflowRunId: string };

export type SavedSlice = Promise<Record<string, string>>;

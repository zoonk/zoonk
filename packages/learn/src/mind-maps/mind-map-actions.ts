import { type ChapterMindMapView, type MindMapStatus } from "@zoonk/core/mind-maps/contract";
import { type MindMapLimit } from "../_components/help-limit-notice";

export type MindMapRequestOutcome =
  | { limit: MindMapLimit; status: "refused" }
  | { status: "drawing" | "failed" | "plusRequired" | "ready" | "unavailable" | "writingLessons" };

/**
 * `request` is a POST from the learner's tap, never a page load. `read` and `readStatus` resolve to
 * null when the server couldn't be reached.
 */
export type MindMapActions = {
  read: (chapterId: string) => Promise<ChapterMindMapView | null>;
  readStatus: (chapterId: string) => Promise<MindMapStatus | null>;
  request: (chapterId: string) => Promise<MindMapRequestOutcome>;
};

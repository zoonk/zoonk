import {
  type ChapterMindMapView,
  type GoalMindMapGenerations,
  type GoalMindMapsView,
  type MindMapStatus,
  type SaveMindMapInput,
} from "@zoonk/core/mind-maps/contract";
import { type MindMapLimit } from "../_components/help-limit-notice";

export type MindMapRequestOutcome =
  | { limit: MindMapLimit; status: "refused" }
  | { status: "drawing" | "failed" | "plusRequired" | "ready" | "unavailable" | "writingLessons" };

/** Resolves to whether the map is saved now, or null when it couldn't be stored. */
export type SaveMindMap = (input: SaveMindMapInput) => Promise<boolean | null>;

/**
 * `request` is a POST from the learner's tap, never a page load. `read` and `readStatus` resolve to
 * null when the server couldn't be reached.
 */
export type MindMapActions = {
  read: (chapterId: string) => Promise<ChapterMindMapView | null>;
  readStatus: (chapterId: string) => Promise<MindMapStatus | null>;
  request: (chapterId: string) => Promise<MindMapRequestOutcome>;
  save: SaveMindMap;
};

/** `requestAll` is a POST from the learner's tap too; both resolve to null when it wasn't reached. */
export type MindMapLibraryActions = Pick<MindMapActions, "request" | "save"> & {
  list: () => Promise<GoalMindMapsView | null>;
  requestAll: () => Promise<GoalMindMapGenerations | null>;
};

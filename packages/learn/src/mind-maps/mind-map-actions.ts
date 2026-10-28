import { type MindMapStatus } from "@zoonk/core/mind-maps/contract";
import { type MindMapLimit } from "../_components/help-limit-notice";

export type MindMapRequestOutcome =
  | { limit: MindMapLimit; status: "refused" }
  | { status: "failed" | "generating" | "ready" | "unavailable" };

/** `request` is a POST from the learner's tap, never a page load; `readStatus` resolves to null when the server couldn't be reached. */
export type MindMapActions = {
  readStatus: (chapterId: string) => Promise<MindMapStatus | null>;
  refresh: () => void;
  request: (chapterId: string) => Promise<MindMapRequestOutcome>;
};

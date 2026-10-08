import { type MindMapStatus } from "@zoonk/core/mind-maps/contract";
import { type MindMapLimit } from "../_components/help-limit-notice";

/**
 * How asking for a chapter's map went: being made (or already `ready`), refused by the learner's
 * mind map limits, not possible for this chapter, or `failed` to reach the server.
 */
export type MindMapRequestOutcome =
  | { limit: MindMapLimit; status: "refused" }
  | { status: "failed" | "generating" | "ready" | "unavailable" };

/**
 * What the host does for a map: ask for it (a POST on the learner's tap, never on a page load),
 * read its status again while it's being made (null when the server couldn't be reached), and read
 * the page again to show it once it's made.
 */
export type MindMapActions = {
  readStatus: (chapterId: string) => Promise<MindMapStatus | null>;
  refresh: () => void;
  request: (chapterId: string) => Promise<MindMapRequestOutcome>;
};

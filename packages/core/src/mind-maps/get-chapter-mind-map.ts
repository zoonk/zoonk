import "server-only";
import { isUuid } from "@zoonk/utils/uuid";
import { loadGoalMap } from "../view-models/_utils/goal-map";
import { resolveViewGoal } from "../view-models/_utils/resolve-view-goal";
import { loadChapterNumbering } from "../view-models/syllabus/_utils/chapter-numbers";
import { loadMindMapChapters } from "./_utils/load-mind-map-chapters";
import { getMindMapStatus, toMindMapImage, toMindMapOutline } from "./_utils/mind-map-view";
import { type ChapterMindMapView } from "./mind-map-contract";

export type ChapterMindMapResult =
  | { mindMap: ChapterMindMapView; status: "ready" }
  | { status: "noGoal" | "notFound" | "unauthorized" };

/**
 * A chapter's mind map for the learner (the active goal by default): ready with its outline and
 * picture, being made, or whether they can ask for it. Maps are for chapters they finished; the
 * map is shared by every learner of the chapter. A chapter outside the goal's plan isn't found.
 */
export async function getChapterMindMap({
  chapterId,
  goalId,
}: {
  chapterId: string;
  goalId?: string;
}): Promise<ChapterMindMapResult> {
  "use cache: private";

  const resolved = await resolveViewGoal(goalId);

  if (resolved.status !== "ready") {
    return resolved;
  }

  if (!isUuid(chapterId)) {
    return { status: "notFound" };
  }

  const { goal } = resolved;
  const map = await loadGoalMap({ goal });

  const [[facts], numbering] = await Promise.all([
    loadMindMapChapters({ chapterIds: [chapterId], goal, map }),
    loadChapterNumbering(goal),
  ]);

  if (!facts) {
    return { status: "notFound" };
  }

  const status = getMindMapStatus({ ...facts, now: new Date() });
  const isReady = status === "ready";

  return {
    mindMap: {
      chapterId,
      image: isReady ? toMindMapImage(facts.row) : null,
      outline: isReady ? toMindMapOutline(facts.row?.structure) : null,
      position: numbering({ chapterId, planPosition: facts.position }).position,
      status,
      title: facts.title,
    },
    status: "ready",
  };
}

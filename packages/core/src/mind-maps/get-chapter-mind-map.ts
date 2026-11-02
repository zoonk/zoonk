import "server-only";
import { isUuid } from "@zoonk/utils/uuid";
import { resolveViewGoal } from "../view-models/_utils/resolve-view-goal";
import { loadChapterNumbering } from "../view-models/syllabus/_utils/chapter-numbers";
import { loadMindMapChapters } from "./_utils/load-mind-map-chapters";
import { getMindMapStatus, toMindMapImage, toMindMapOutline } from "./_utils/mind-map-view";
import { type ChapterMindMapView } from "./mind-map-contract";

export type ChapterMindMapResult =
  | { mindMap: ChapterMindMapView; status: "ready" }
  | { status: "noGoal" | "notFound" | "unauthorized" };

/** Defaults to the active goal; returns notFound for chapters outside its plan. */
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
  const now = new Date();

  const [[facts], numbering] = await Promise.all([
    loadMindMapChapters({ chapterIds: [chapterId], goal }),
    loadChapterNumbering(goal),
  ]);

  if (!facts) {
    return { status: "notFound" };
  }

  const status = getMindMapStatus({ ...facts, now });
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

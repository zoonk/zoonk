import "server-only";
import { isUuid } from "@zoonk/utils/uuid";
import { readEntitlementViewer } from "../entitlements/_utils/entitlement-viewer";
import { getRequestInstant } from "../learner/facts/request-instant";
import { readSavedMindMaps } from "../learner/facts/saved-mind-maps";
import { resolveViewGoal } from "../view-models/_utils/resolve-view-goal";
import { loadChapterNumbering } from "../view-models/syllabus/_utils/chapter-numbers";
import { loadMindMapChapters } from "./_utils/load-mind-map-chapters";
import { toChapterMindMapView } from "./_utils/mind-map-view";
import { toSavedKey, toSavedKeys } from "./_utils/saved-mind-map-views";
import { type ChapterMindMapView } from "./mind-map-contract";

export type ChapterMindMapResult =
  | { mindMap: ChapterMindMapView; status: "ready" }
  | { status: "noGoal" | "notFound" | "unauthorized" };

/** Defaults to the active goal; returns notFound for chapters outside its mind map scope. */
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

  const [[facts], numbering, now, savedRows] = await Promise.all([
    loadMindMapChapters({ chapterIds: [chapterId], goal, readViewer: readEntitlementViewer }),
    loadChapterNumbering(goal),
    getRequestInstant(),
    readSavedMindMaps(goal.userId),
  ]);

  if (!facts) {
    return { status: "notFound" };
  }

  const { position } = numbering({ chapterId, planPosition: facts.position });

  const saved = toSavedKeys(savedRows).has(toSavedKey({ kind: "chapter", targetId: chapterId }));

  return { mindMap: toChapterMindMapView({ facts, now, position, saved }), status: "ready" };
}

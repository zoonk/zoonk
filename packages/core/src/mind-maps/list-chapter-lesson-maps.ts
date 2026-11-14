import "server-only";
import { isUuid } from "@zoonk/utils/uuid";
import { readSavedMindMaps } from "../learner/facts/saved-mind-maps";
import { resolveViewGoal } from "../view-models/_utils/resolve-view-goal";
import { loadChapterNumbering } from "../view-models/syllabus/_utils/chapter-numbers";
import { loadMindMapChapters } from "./_utils/load-mind-map-chapters";
import { toSavedKey, toSavedKeys } from "./_utils/saved-mind-map-views";
import { loadScopeLessonMaps } from "./_utils/scope-lesson-maps";
import { type ChapterLessonMapsView } from "./lesson-maps-contract";

export type ChapterLessonMapsResult =
  | { lessonMaps: ChapterLessonMapsView; status: "ready" }
  | { status: "noGoal" | "notFound" | "unauthorized" };

/**
 * Every written lesson's map in a chapter of the goal's mind map scope, studied or not, with the
 * learner's saves; notFound for a chapter outside the scope or one without maps.
 */
export async function listChapterLessonMaps({
  chapterId,
  goalId,
}: {
  chapterId: string;
  goalId?: string;
}): Promise<ChapterLessonMapsResult> {
  "use cache: private";

  const resolved = await resolveViewGoal(goalId);

  if (resolved.status !== "ready") {
    return resolved;
  }

  if (!isUuid(chapterId)) {
    return { status: "notFound" };
  }

  const { goal } = resolved;

  const [[facts], numbering, savedRows] = await Promise.all([
    loadMindMapChapters({ chapterIds: [chapterId], goal }),
    loadChapterNumbering(goal),
    readSavedMindMaps(goal.userId),
  ]);

  if (!facts?.canHaveMap) {
    return { status: "notFound" };
  }

  const lessonMaps = await loadScopeLessonMaps({ chapters: [facts], userId: goal.userId });
  const saved = toSavedKeys(savedRows);

  return {
    lessonMaps: {
      chapter: {
        id: chapterId,
        position: numbering({ chapterId, planPosition: facts.position }).position,
        title: facts.title,
      },
      lessons: (lessonMaps.get(chapterId) ?? []).map((map) => ({
        lessonId: map.lessonId,
        map: map.map,
        position: map.position,
        saved: saved.has(toSavedKey({ kind: "lesson", targetId: map.lessonId })),
        title: map.title,
      })),
    },
    status: "ready",
  };
}

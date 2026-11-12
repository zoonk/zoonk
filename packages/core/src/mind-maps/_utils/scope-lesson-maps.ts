import "server-only";
import { isVisibleTo } from "../../library/_utils/library-visibility";
import { type ChapterLessonMap, getChapterLessonMaps } from "./chapter-lesson-maps";
import { type MindMapChapterFacts } from "./load-mind-map-chapters";

export type ScopeLessonMap = ChapterLessonMap & { chapterId: string; locked: boolean };

/** Each chapter's lesson maps the learner can see, with the Plus lock its plan puts on them. */
export async function loadScopeLessonMaps({
  chapters,
  userId,
}: {
  chapters: readonly Pick<MindMapChapterFacts, "chapterId" | "plusLessonIds">[];
  userId: string;
}): Promise<Map<string, ScopeLessonMap[]>> {
  const maps = await getChapterLessonMaps(chapters.map((chapter) => chapter.chapterId));

  return new Map(
    chapters.map((chapter) => [
      chapter.chapterId,
      (maps.get(chapter.chapterId) ?? [])
        .filter((map) => isVisibleTo({ row: map, viewerId: userId }))
        .map((map) => ({
          ...map,
          chapterId: chapter.chapterId,
          locked: chapter.plusLessonIds.includes(map.lessonId),
        })),
    ]),
  );
}

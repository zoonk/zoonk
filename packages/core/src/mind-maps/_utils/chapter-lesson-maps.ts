import "server-only";
import { type LibraryVisibility, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getLibraryChapterCacheTag, getLibraryLessonCacheTag } from "../../cache/tags";
import { loadLessonIcons } from "../../lesson-player/_utils/lesson-marks";
import {
  type LessonMap,
  readPlayableLessonMap,
  readSavedLessonMap,
} from "../../library/lessons/lesson-map";

export type ChapterLessonMap = {
  lessonId: string;
  map: LessonMap;
  ownerId: string | null;
  /** The lesson's number in its chapter. */
  position: number;
  title: string;
  visibility: LibraryVisibility;
};

/**
 * Shared content, before any viewer's filter: the chapter's written lessons whose published map
 * reads (never a staged one), in chapter order, with their icons. Maps written before ideas had
 * labels are included. The lesson-map counts read this too, so they match what opens.
 */
export async function getChapterLessonMaps(chapterId: string): Promise<ChapterLessonMap[]> {
  "use cache";
  cacheTag(getLibraryChapterCacheTag(chapterId));

  const placements = await prisma.chapterLesson.findMany({
    orderBy: { position: "asc" },
    select: {
      lesson: {
        select: {
          contentStatus: true,
          id: true,
          ownerId: true,
          summary: true,
          title: true,
          visibility: true,
        },
      },
    },
    where: { chapterId },
  });

  cacheTag(...placements.map(({ lesson }) => getLibraryLessonCacheTag(lesson.id)));

  const written = placements
    .map(({ lesson }, index) => ({ lesson, position: index + 1 }))
    .filter(({ lesson }) => lesson.contentStatus === "completed");

  const icons = await loadLessonIcons(
    written.flatMap(({ lesson }) =>
      (readSavedLessonMap(lesson.summary)?.ideas ?? []).flatMap((idea) => idea.iconId ?? []),
    ),
  );

  return written.flatMap(({ lesson, position }) => {
    const map = readPlayableLessonMap({ icons, summary: lesson.summary });

    return map
      ? [
          {
            lessonId: lesson.id,
            map,
            ownerId: lesson.ownerId,
            position,
            title: lesson.title,
            visibility: lesson.visibility,
          },
        ]
      : [];
  });
}

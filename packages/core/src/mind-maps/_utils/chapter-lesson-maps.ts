import "server-only";
import { type LibraryVisibility, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getLibraryChapterCacheTag, getLibraryLessonCacheTag } from "../../cache/tags";
import { loadLessonIcons } from "../../lesson-player/_utils/lesson-marks";
import { isChallengeIdentityKey } from "../../library/challenges/challenge-lesson-spec";
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

async function readChapterLessonMaps({
  chapterId,
}: {
  chapterId: string;
  version: number;
}): Promise<ChapterLessonMap[]> {
  "use cache";
  cacheTag(getLibraryChapterCacheTag(chapterId));

  const placements = await prisma.chapterLesson.findMany({
    orderBy: { position: "asc" },
    select: {
      lesson: {
        select: {
          contentStatus: true,
          id: true,
          identityKey: true,
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
    .filter(
      ({ lesson }) =>
        lesson.contentStatus === "completed" && !isChallengeIdentityKey(lesson.identityKey),
    );

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

/** Each app has its own cache and the API writes lessons, so a fresh key sees its writes. */
async function findChapterVersions(chapterIds: readonly string[]): Promise<Map<string, number>> {
  const placements = await prisma.chapterLesson.findMany({
    select: { chapterId: true, lesson: { select: { updatedAt: true } } },
    where: { chapterId: { in: [...chapterIds] } },
  });

  return placements.reduce(
    (versions, { chapterId, lesson }) =>
      versions.set(chapterId, Math.max(versions.get(chapterId) ?? 0, lesson.updatedAt.getTime())),
    new Map<string, number>(),
  );
}

/**
 * Shared content, before any viewer's filter: each chapter's written lessons whose published map
 * reads (never a staged one), in chapter order, with their icons. Maps written before ideas had
 * labels are included. A challenge is left out: its summary recaps a case, not a map the lesson
 * writer drew. The lesson-map counts, saves and the Saved tab read this too, so they match what
 * opens.
 */
export async function getChapterLessonMaps(
  chapterIds: readonly string[],
): Promise<Map<string, ChapterLessonMap[]>> {
  const versions = await findChapterVersions(chapterIds);

  const loaded = await Promise.all(
    chapterIds.map(
      async (chapterId) =>
        [
          chapterId,
          await readChapterLessonMaps({ chapterId, version: versions.get(chapterId) ?? 0 }),
        ] as const,
    ),
  );

  return new Map(loaded);
}

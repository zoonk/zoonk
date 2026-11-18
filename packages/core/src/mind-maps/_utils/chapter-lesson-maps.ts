import "server-only";
import { type LessonGetPayload, type LibraryVisibility, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getLibraryChapterCacheTag, getLibraryLessonCacheTag } from "../../cache/tags";
import { loadLessonIcons } from "../../lesson-player/_utils/lesson-marks";
import { isChallengeIdentityKey } from "../../library/challenges/challenge-lesson-spec";
import { type LessonIcon } from "../../library/icons/lesson-icon-contract";
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

type ChapterVersion = { chapterId: string; version: number };

const LESSON_MAP_SELECT = {
  contentStatus: true,
  id: true,
  identityKey: true,
  ownerId: true,
  summary: true,
  title: true,
  visibility: true,
} as const;

type PlacedLesson = {
  lesson: LessonGetPayload<{ select: typeof LESSON_MAP_SELECT }>;
  position: number;
};

function isWrittenMap({ lesson }: PlacedLesson): boolean {
  return lesson.contentStatus === "completed" && !isChallengeIdentityKey(lesson.identityKey);
}

function findIconIds(lessons: readonly PlacedLesson[]): string[] {
  return lessons.flatMap(({ lesson }) =>
    (readSavedLessonMap(lesson.summary)?.ideas ?? []).flatMap((idea) => idea.iconId ?? []),
  );
}

function toChapterLessonMaps({
  icons,
  lessons,
}: {
  icons: ReadonlyMap<string, LessonIcon>;
  lessons: readonly PlacedLesson[];
}): ChapterLessonMap[] {
  return lessons.flatMap(({ lesson, position }) => {
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

async function readChapterLessonMaps({
  chapters,
}: {
  chapters: readonly ChapterVersion[];
}): Promise<Map<string, ChapterLessonMap[]>> {
  "use cache";

  const chapterIds = chapters.map((chapter) => chapter.chapterId);

  const placements = await prisma.chapterLesson.findMany({
    orderBy: { position: "asc" },
    select: { chapterId: true, lesson: { select: LESSON_MAP_SELECT } },
    where: { chapterId: { in: chapterIds } },
  });

  const grouped = Map.groupBy(placements, (placement) => placement.chapterId);

  const placed = chapterIds.map((chapterId) => ({
    chapterId,
    lessons: (grouped.get(chapterId) ?? []).map(({ lesson }, index) => ({
      lesson,
      position: index + 1,
    })),
  }));

  // Next keeps only the first 128 tags of one call, so each chapter tags its own lessons.
  for (const { chapterId, lessons } of placed) {
    cacheTag(getLibraryChapterCacheTag(chapterId));
    cacheTag(...lessons.map(({ lesson }) => getLibraryLessonCacheTag(lesson.id)));
  }

  const written = placed.map(({ chapterId, lessons }) => ({
    chapterId,
    lessons: lessons.filter((lesson) => isWrittenMap(lesson)),
  }));

  const icons = await loadLessonIcons(written.flatMap(({ lessons }) => findIconIds(lessons)));

  return new Map(
    written.map(({ chapterId, lessons }) => [chapterId, toChapterLessonMaps({ icons, lessons })]),
  );
}

/** Each app has its own cache and the API writes lessons, so a fresh key sees its writes. */
async function findChapterVersions(chapterIds: readonly string[]): Promise<ChapterVersion[]> {
  const placements = await prisma.chapterLesson.findMany({
    select: { chapterId: true, lesson: { select: { updatedAt: true } } },
    where: { chapterId: { in: [...chapterIds] } },
  });

  const versions = placements.reduce(
    (latest, { chapterId, lesson }) =>
      latest.set(chapterId, Math.max(latest.get(chapterId) ?? 0, lesson.updatedAt.getTime())),
    new Map<string, number>(),
  );

  return chapterIds.map((chapterId) => ({ chapterId, version: versions.get(chapterId) ?? 0 }));
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
  if (chapterIds.length === 0) {
    return new Map();
  }

  return readChapterLessonMaps({ chapters: await findChapterVersions(chapterIds) });
}

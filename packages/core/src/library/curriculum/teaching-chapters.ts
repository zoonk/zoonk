import "server-only";
import { type CourseLevel, prisma } from "@zoonk/db";
import { revalidateCourseContent } from "../../cache/revalidate-course-content";
import { getCourseCurriculumCacheTag } from "../../cache/tags";
import { libraryRowsVisibleTo } from "../_utils/library-visibility";
import { lockPlanSourceWrite, writePlanInputs } from "../_utils/plan-input-write";
import { isChallengeIdentityKey } from "../challenges/challenge-lesson-spec";
import { needsTool } from "../chapters/chapter-tools";

type BandChapter = { chapterId: string; lessons: string[]; title: string };

type ChapterSkills = { chapterId: string; skillIds: readonly string[] };

/** Internal: the calling workflow must hold the course's outline claim. */
export async function loadBandChapters({
  courseId,
  level,
  ownerId,
  withToolChapters,
}: {
  courseId: string;
  level: CourseLevel;
  ownerId: string | null;
  withToolChapters: boolean;
}): Promise<BandChapter[]> {
  const visible = libraryRowsVisibleTo(ownerId);

  const placements = await prisma.courseChapter.findMany({
    orderBy: { position: "asc" },
    select: {
      chapter: {
        select: {
          lessons: {
            orderBy: { position: "asc" },
            select: { lesson: { select: { identityKey: true, title: true } } },
            where: { lesson: { ...visible, setAsideAt: null } },
          },
          title: true,
          tools: true,
        },
      },
      chapterId: true,
    },
    where: { chapter: visible, courseId, level },
  });

  const usable = placements.filter((at) => withToolChapters || !needsTool(at.chapter.tools));

  const chapters = usable.map(({ chapter, chapterId }) => ({
    chapterId,
    lessons: chapter.lessons
      .filter((entry) => !isChallengeIdentityKey(entry.lesson.identityKey))
      .map((entry) => entry.lesson.title),
    title: chapter.title,
  }));

  return chapters.filter((chapter) => chapter.lessons.length > 0);
}

export async function tagChapterSkills(tags: readonly ChapterSkills[]): Promise<void> {
  await writePlanInputs(async (tx) => {
    await lockPlanSourceWrite(tx, {
      chapterIds: tags.map((tag) => tag.chapterId),
      skillIds: [...new Set(tags.flatMap((tag) => tag.skillIds))],
    });

    await tx.chapterSkill.createMany({
      data: tags.flatMap(({ chapterId, skillIds }) =>
        skillIds.map((skillId) => ({ chapterId, skillId })),
      ),
      skipDuplicates: true,
    });
  });
}

/** Internal: the calling workflow must hold the course's outline claim. */
export async function tagTeachingChapters({
  courseId,
  tags,
}: {
  courseId: string;
  tags: readonly ChapterSkills[];
}): Promise<void> {
  if (tags.length === 0) {
    return;
  }

  await tagChapterSkills(tags);
  await revalidateCourseContent([getCourseCurriculumCacheTag(courseId)]);
}

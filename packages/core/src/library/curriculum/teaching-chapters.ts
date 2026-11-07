import "server-only";
import { findMixedAreaChapters } from "@zoonk/ai/tasks/curriculum/outline-areas";
import { type CourseLevel, prisma } from "@zoonk/db";
import { revalidateCourseContent } from "../../cache/revalidate-course-content";
import { getCourseCurriculumCacheTag } from "../../cache/tags";
import { libraryRowsVisibleTo } from "../_utils/library-visibility";
import { lockPlanSourceWrite, writePlanInputs } from "../_utils/plan-input-write";
import { isChallengeIdentityKey } from "../challenges/challenge-lesson-spec";
import { needsTool } from "../chapters/chapter-tools";
import { type CurriculumScope } from "./curriculum-scope";

type BandChapter = { chapterId: string; lessons: string[]; skillIds: string[]; title: string };

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
          goalSkills: { select: { skillId: true } },
          lessons: {
            orderBy: { position: "asc" },
            select: {
              lesson: {
                select: { identityKey: true, skills: { select: { skillId: true } }, title: true },
              },
            },
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
    skillIds: [
      ...new Set([
        ...chapter.goalSkills.map((tag) => tag.skillId),
        ...chapter.lessons.flatMap((entry) => entry.lesson.skills.map((tag) => tag.skillId)),
      ]),
    ],
    title: chapter.title,
  }));

  return chapters.filter((chapter) => chapter.lessons.length > 0);
}

type Teaching = { chapterId: string; skill: { area?: string | null; id: string } };

/**
 * A plan files each of a chapter's lessons under one of its skills, so a chapter an exam reuses
 * keeps to one of its subjects. What the chapter and its lessons teach already counts, by the area
 * `skillAreas` gives each of the exam goal's skills; other goals' skills have none.
 */
export function keepToOneSubject<T extends Teaching>({
  chapters,
  scope,
  skillAreas = {},
  teaching,
}: {
  chapters: readonly BandChapter[];
  scope: Pick<CurriculumScope, "exams">;
  skillAreas?: Readonly<Record<string, string>>;
  teaching: readonly T[];
}): T[] {
  if (!scope.exams?.length) {
    return [...teaching];
  }

  const mixed = findMixedAreaChapters({
    chapters: chapters.map((chapter) => ({
      skillKeys: [
        ...chapter.skillIds,
        ...teaching.flatMap((entry) =>
          entry.chapterId === chapter.chapterId ? entry.skill.id : [],
        ),
      ],
      title: chapter.title,
    })),
    skills: [
      ...Object.entries(skillAreas).map(([key, area]) => ({ area, key })),
      ...teaching.map((entry) => ({ area: entry.skill.area, key: entry.skill.id })),
    ],
  });

  const mixedTitles = new Set(mixed.map((chapter) => chapter.title));

  const mixedIds = new Set(
    chapters.flatMap((chapter) => (mixedTitles.has(chapter.title) ? chapter.chapterId : [])),
  );

  return teaching.filter((entry) => !mixedIds.has(entry.chapterId));
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

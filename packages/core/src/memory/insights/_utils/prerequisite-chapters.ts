import "server-only";
import { prisma } from "@zoonk/db";
import { libraryRowsVisibleTo } from "../../../library/_utils/library-visibility";
import { type ActivitySkill } from "./activity-signals";
import { loadKnownSkillIds } from "./prerequisite-chain";

type ChapterGapSkills = { id: string; skills: ActivitySkill[]; title: string };

const SKILL_SELECT = { select: { id: true, mergedIntoId: true, name: true } } as const;

type SkillRow = { id: string; mergedIntoId: string | null; name: string };

function uniqueSkills(skills: readonly SkillRow[]): SkillRow[] {
  return skills.filter(
    (skill, index) => skills.findIndex((other) => other.id === skill.id) === index,
  );
}

/**
 * The skills a chapter would add to a plan, in chapter order: the skills a course outline tagged
 * the chapter with (each brings the whole chapter), then the skills its lessons teach. Skills the
 * plan already teaches (`excludedIds`), merged skills and skills the learner has started are left
 * out. Private chapters and lessons count only for their owner.
 */
export async function loadChapterGapSkills({
  chapterIds,
  excludedIds,
  userId,
}: {
  chapterIds: readonly string[];
  excludedIds: readonly string[];
  userId: string;
}): Promise<Map<string, ChapterGapSkills>> {
  const visible = libraryRowsVisibleTo(userId);

  const chapters = await prisma.chapter.findMany({
    select: {
      goalSkills: { orderBy: { createdAt: "asc" }, select: { skill: SKILL_SELECT } },
      id: true,
      lessons: {
        orderBy: { position: "asc" },
        select: {
          lesson: {
            select: { skills: { orderBy: { createdAt: "asc" }, select: { skill: SKILL_SELECT } } },
          },
        },
        where: { lesson: visible },
      },
      title: true,
    },
    where: { id: { in: [...chapterIds] }, ...visible },
  });

  const excluded = new Set(excludedIds);

  const candidates = chapters.map((chapter) => ({
    id: chapter.id,
    skills: uniqueSkills([
      ...chapter.goalSkills.map((row) => row.skill),
      ...chapter.lessons.flatMap((row) =>
        row.lesson.skills.map((lessonSkill) => lessonSkill.skill),
      ),
    ]).filter((skill) => skill.mergedIntoId === null && !excluded.has(skill.id)),
    title: chapter.title,
  }));

  const known = await loadKnownSkillIds({
    skillIds: candidates.flatMap((chapter) => chapter.skills.map((skill) => skill.id)),
    userId,
  });

  return new Map(
    candidates.map((chapter) => [
      chapter.id,
      {
        id: chapter.id,
        skills: chapter.skills
          .filter((skill) => !known.has(skill.id))
          .map((skill) => ({ id: skill.id, name: skill.name })),
        title: chapter.title,
      },
    ]),
  );
}

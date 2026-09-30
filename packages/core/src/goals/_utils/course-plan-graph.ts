import { CourseLevel } from "@zoonk/db";
import { type SupportedLocale, getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { type PlanGraph, type PlanGraphSkill } from "../../plans/planner/plan-state";

const LEVEL_ORDER = Object.values(CourseLevel);

/**
 * A course plan's phases are its level bands, named in the course's language: phase names are
 * stored with the plan like the ones a skill graph writes, so they're content, not interface copy
 * (the same words the course page's levels use).
 */
const LEVEL_PHASE_NAMES: Readonly<Record<SupportedLocale, Record<CourseLevel, string>>> = {
  de: {
    advanced: "Fortgeschritten",
    beginner: "Anfänger",
    intermediate: "Mittelstufe",
    overview: "Überblick",
  },
  en: {
    advanced: "Advanced",
    beginner: "Beginner",
    intermediate: "Intermediate",
    overview: "Overview",
  },
  es: {
    advanced: "Avanzado",
    beginner: "Principiante",
    intermediate: "Intermedio",
    overview: "Resumen",
  },
  fr: {
    advanced: "Avancé",
    beginner: "Débutant",
    intermediate: "Intermédiaire",
    overview: "Aperçu",
  },
  pt: {
    advanced: "Avançado",
    beginner: "Iniciante",
    intermediate: "Intermediário",
    overview: "Visão geral",
  },
};

type OutlineSkill = { id: string; name: string };

/** One chapter of a course's outline, as the plan reads it. */
export type CourseOutlineChapter = {
  chapterId: string;
  level: CourseLevel;
  /** The chapter's plannable lessons in order (a challenge included), each with its skills. */
  lessons: OutlineSkill[][];
  position: number;
  /** The skill-graph skills a course outline tagged the chapter with. */
  tags: OutlineSkill[];
};

function compareChapters(a: CourseOutlineChapter, b: CourseOutlineChapter): number {
  return LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) || a.position - b.position;
}

/** The chapters the plan covers: all of them, or from the chapter the learner started at. */
function sliceFromChapter({
  chapters,
  startChapterId,
}: {
  chapters: CourseOutlineChapter[];
  startChapterId: string | null;
}): CourseOutlineChapter[] {
  const start = startChapterId
    ? chapters.findIndex((chapter) => chapter.chapterId === startChapterId)
    : 0;

  return start === -1 ? [] : chapters.slice(start);
}

/** Tags only one chapter of the course carries: planning one takes just that chapter's lessons. */
function findOwnTags(chapters: readonly CourseOutlineChapter[]): Set<string> {
  const counts = Map.groupBy(
    chapters.flatMap((chapter) => [...new Set(chapter.tags.map((tag) => tag.id))]),
    (id) => id,
  );

  return new Set([...counts].flatMap(([id, found]) => (found.length === 1 ? [id] : [])));
}

/** How many of the plan's lessons teach each skill, which sizes the skill in the graph. */
function countSkillLessons(chapters: readonly CourseOutlineChapter[]): Map<string, number> {
  const taught = chapters.flatMap((chapter) =>
    chapter.lessons.flatMap((skills) => [...new Set(skills.map((skill) => skill.id))]),
  );

  return new Map([...Map.groupBy(taught, (id) => id)].map(([id, found]) => [id, found.length]));
}

/**
 * A chapter's skills in the order the planner should meet them: each lesson's own skills, so its
 * lessons come in chapter order, then a tag no other chapter carries, which brings the lesson
 * with no skill of its own (the chapter's challenge) in at the chapter's end. A tag several
 * chapters share would pull their lessons together, so those chapters are planned lesson by
 * lesson.
 */
function toChapterSkills({
  chapter,
  lessonCounts,
  ownTags,
}: {
  chapter: CourseOutlineChapter;
  lessonCounts: ReadonlyMap<string, number>;
  ownTags: ReadonlySet<string>;
}): { lessons: number; skill: OutlineSkill }[] {
  const lessonSkills = chapter.lessons
    .flat()
    .map((skill) => ({ lessons: lessonCounts.get(skill.id) ?? 1, skill }));

  const tags = chapter.tags
    .filter((tag) => ownTags.has(tag.id))
    .map((skill) => ({ lessons: chapter.lessons.length, skill }));

  return [...lessonSkills, ...tags];
}

/**
 * The plan graph of a goal started from a Library course: the course's outline in its own order,
 * so the plan teaches the course the way its page shows it. Each outlined level band is a phase
 * (a checkpoint closes it and placement looks for a start in each); skills come chapter by
 * chapter, a skill taught in several chapters where it first appears, sized by its lessons in the
 * plan. Skills take their lessons only from this course, and the course names their area. A
 * chapter start leaves out the chapters before it: the learner chose where to begin.
 */
export function toCoursePlanGraph({
  chapters,
  course,
  startChapterId,
}: {
  chapters: readonly CourseOutlineChapter[];
  course: { id: string; language: string; title: string };
  startChapterId: string | null;
}): PlanGraph {
  const ordered = chapters.toSorted(compareChapters);
  const planned = sliceFromChapter({ chapters: ordered, startChapterId });
  const levels = [...new Set(planned.map((chapter) => chapter.level))];
  const ownTags = findOwnTags(ordered);
  const lessonCounts = countSkillLessons(planned);
  const names = LEVEL_PHASE_NAMES[getSupportedLocaleFromLanguage(course.language)];

  const skills = planned.flatMap((chapter) =>
    toChapterSkills({ chapter, lessonCounts, ownTags }).map(
      ({ lessons, skill }): PlanGraphSkill => ({
        area: course.title,
        courseIds: [course.id],
        lessons: Math.max(1, lessons),
        name: skill.name,
        phase: levels.indexOf(chapter.level),
        skillId: skill.id,
        weight: null,
      }),
    ),
  );

  return {
    phases: levels.map((level) => ({ milestone: null, name: names[level] })),
    skills: skills.filter(
      (skill, index) => skills.findIndex((other) => other.skillId === skill.skillId) === index,
    ),
  };
}

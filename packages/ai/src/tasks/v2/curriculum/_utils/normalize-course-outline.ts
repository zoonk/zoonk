import { normalizeString } from "@zoonk/utils/string";
import { LESSON_SIZE, getMaxLessonMinutes } from "../../lesson-spec/lesson-spec-rules";
import { type CourseLevel } from "./course-levels";

/** Tool names are short generic names; a chapter rarely needs more than a few. */
const MAX_CHAPTER_TOOLS = 4;

type RawOutlineTool = { essential: boolean; name: string };

type RawOutlineLesson = {
  canDo: string;
  description: string;
  estimatedMinutes: number;
  skills: string[];
  title: string;
};

export type RawCourseOutline = {
  chapters: {
    description: string;
    lessons: RawOutlineLesson[];
    objectives: string[];
    skillKeys: string[];
    title: string;
    tools: RawOutlineTool[];
  }[];
};

type OutlineLesson = {
  title: string;
  /** One line on what the lesson covers and why it's useful. */
  description: string;
  /** What the learner can do afterwards, shown on session tiles. */
  canDo: string;
  estimatedMinutes: number;
  /** The skills the lesson teaches, as actions. Its identity in the Library. */
  skills: string[];
};

type OutlineChapter = {
  title: string;
  description: string;
  /** What the learner can do after the chapter. */
  objectives: string[];
  /** Keys of the required skills this chapter teaches. */
  skillKeys: string[];
  /**
   * What the learner uses on their own device for this chapter, such as "Python": `essential`
   * when practicing the chapter needs it. Empty for chapters that need nothing.
   */
  tools: RawOutlineTool[];
  lessons: OutlineLesson[];
};

export type CourseOutline = {
  chapters: OutlineChapter[];
  /** Required skills no chapter claims to teach, for the caller to handle. */
  uncoveredSkillKeys: string[];
};

/** Trims, drops empty entries and keeps the first of entries that only differ in case or accents. */
function cleanList(items: readonly string[]): string[] {
  const trimmed = items.map((item) => item.trim()).filter(Boolean);
  const keys = trimmed.map((item) => normalizeString(item));

  return trimmed.filter((_, index) => keys.indexOf(keys[index] ?? "") === index);
}

/**
 * Trims names, drops empty ones and keeps one entry per tool (differing only in case or accents),
 * essential when any of its entries is.
 */
function cleanTools(tools: readonly RawOutlineTool[]): RawOutlineTool[] {
  const named = tools
    .map((tool) => ({ ...tool, key: normalizeString(tool.name), name: tool.name.trim() }))
    .filter((tool) => tool.name);

  return named
    .filter((tool, index) => named.findIndex((other) => other.key === tool.key) === index)
    .map((tool) => ({
      essential: named.some((other) => other.key === tool.key && other.essential),
      name: tool.name,
    }))
    .slice(0, MAX_CHAPTER_TOOLS);
}

function normalizeLesson({
  lesson,
  level,
}: {
  lesson: RawOutlineLesson;
  level: CourseLevel;
}): OutlineLesson {
  const skills = cleanList(lesson.skills);
  const maxMinutes = getMaxLessonMinutes({ level, skillCount: skills.length });

  return {
    canDo: lesson.canDo.trim(),
    description: lesson.description.trim(),
    estimatedMinutes: Math.min(
      maxMinutes,
      Math.max(LESSON_SIZE.minMinutes, Math.round(lesson.estimatedMinutes)),
    ),
    skills,
    title: lesson.title.trim(),
  };
}

/**
 * Cleans the model's outline for storage: trimmed text, no empty lessons or
 * chapters, lesson minutes inside the lesson size rules, one entry per tool,
 * and chapter skill keys limited to the required skills. Required skills no chapter teaches
 * are reported instead of silently lost.
 */
export function normalizeCourseOutline({
  level,
  raw,
  requiredSkillKeys,
}: {
  level: CourseLevel;
  raw: RawCourseOutline;
  requiredSkillKeys: readonly string[];
}): CourseOutline {
  const required = new Set(requiredSkillKeys);

  const chapters = raw.chapters.flatMap((chapter) => {
    const lessons = chapter.lessons
      .filter((lesson) => lesson.title.trim())
      .map((lesson) => normalizeLesson({ lesson, level }));

    if (!chapter.title.trim() || lessons.length === 0) {
      return [];
    }

    return [
      {
        description: chapter.description.trim(),
        lessons,
        objectives: cleanList(chapter.objectives),
        skillKeys: [...new Set(chapter.skillKeys.map((key) => key.trim()))].filter((key) =>
          required.has(key),
        ),
        title: chapter.title.trim(),
        tools: cleanTools(chapter.tools),
      },
    ];
  });

  const covered = new Set(chapters.flatMap((chapter) => chapter.skillKeys));

  return { chapters, uncoveredSkillKeys: requiredSkillKeys.filter((key) => !covered.has(key)) };
}

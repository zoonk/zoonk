import { normalizeString } from "@zoonk/utils/string";
import { findPlaceholderText } from "@zoonk/utils/text-flaws";
import { toPlainLine } from "@zoonk/utils/text-repairs";
import { LESSON_SIZE, getMaxLessonMinutes } from "../../lesson-spec/lesson-spec-rules";
import { type CourseLevel } from "./course-levels";
import { type OutlineAreaSkill, splitMixedAreaChapters } from "./outline-areas";

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
  description: string;
  canDo: string;
  estimatedMinutes: number;
  /** Its identity in the Library. */
  skills: string[];
};

type OutlineChapter = {
  title: string;
  description: string;
  objectives: string[];
  skillKeys: string[];
  /** `essential` when practicing the chapter needs it. */
  tools: RawOutlineTool[];
  lessons: OutlineLesson[];
};

export type CourseOutline = { chapters: OutlineChapter[]; uncoveredSkillKeys: string[] };

/**
 * An unfinished text ("[Insert title]", "TODO") counts as none, so it drops its lesson or chapter.
 */
function cleanText(text: string): string {
  const plain = toPlainLine(text);
  return findPlaceholderText(plain).length > 0 ? "" : plain;
}

function cleanList(items: readonly string[]): string[] {
  const trimmed = items.map((item) => cleanText(item)).filter(Boolean);
  const keys = trimmed.map((item) => normalizeString(item));

  return trimmed.filter((_, index) => keys.indexOf(keys[index] ?? "") === index);
}

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
    canDo: cleanText(lesson.canDo),
    description: cleanText(lesson.description),
    estimatedMinutes: Math.min(
      maxMinutes,
      Math.max(LESSON_SIZE.minMinutes, Math.round(lesson.estimatedMinutes)),
    ),
    skills,
    title: cleanText(lesson.title),
  };
}

/** Required skills no chapter teaches are reported instead of silently lost. */
export function normalizeCourseOutline({
  level,
  raw,
  requiredSkillKeys,
  skillAreas = [],
}: {
  level: CourseLevel;
  raw: RawCourseOutline;
  requiredSkillKeys: readonly string[];
  skillAreas?: readonly OutlineAreaSkill[];
}): CourseOutline {
  const required = new Set(requiredSkillKeys);

  const cleaned = raw.chapters.flatMap((chapter) => {
    const lessons = chapter.lessons
      .map((lesson) => normalizeLesson({ lesson, level }))
      .filter((lesson) => lesson.title);

    const title = cleanText(chapter.title);

    if (!title || lessons.length === 0) {
      return [];
    }

    return [
      {
        description: cleanText(chapter.description),
        lessons,
        objectives: cleanList(chapter.objectives),
        skillKeys: [...new Set(chapter.skillKeys.map((key) => key.trim()))].filter((key) =>
          required.has(key),
        ),
        title,
        tools: cleanTools(chapter.tools),
      },
    ];
  });

  const chapters = splitMixedAreaChapters({ chapters: cleaned, skills: skillAreas });
  const covered = new Set(chapters.flatMap((chapter) => chapter.skillKeys));

  return { chapters, uncoveredSkillKeys: requiredSkillKeys.filter((key) => !covered.has(key)) };
}

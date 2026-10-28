import { formatCast } from "../../_utils/cast";
import { type ChapterLesson, formatChapterLessons } from "../../_utils/chapter-lessons";
import { formatLocalContext } from "../../_utils/language-context";
import { formatLessonDocuments } from "../../_utils/lesson-documents";
import { type LessonExam, formatLessonExams } from "../../_utils/lesson-exams";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import { type CourseLevel } from "../curriculum/_utils/course-levels";
import {
  type LessonScreen,
  type LessonSpec,
  type LessonSpecSkill,
} from "../lesson-spec/lesson-spec-rules";
import { getWrittenKinds } from "./written-lesson-schema";

type LessonActivityTemplate = { id: string; description: string; schema: string };

export type LessonWritingContext = {
  language: string;
  level: CourseLevel;
  courseTitle: string;
  chapterTitle: string;
  spec: LessonSpec;
  activityTemplates: LessonActivityTemplate[];
  chapterLessons?: ChapterLesson[];
  material?: string;
  sources?: string;
  exams?: LessonExam[];
  setup?: boolean;
  /** Otherwise the lesson asks only what learners pick (`getWrittenKinds`). */
  shortAnswers?: boolean;
};

/** `screen` is a 0-based index, or null for the whole lesson. */
export type LessonProblem = { screen: number | null; problem: string };

export function formatLessonProblems(problems: readonly LessonProblem[]): string {
  return problems
    .map((problem) =>
      problem.screen === null
        ? `- Whole lesson: ${problem.problem}`
        : `- Screen ${problem.screen + 1}: ${problem.problem}`,
    )
    .join("\n");
}

function formatSkill(skill: LessonSpecSkill, index: number): string {
  return [
    `${index + 1}. ${skill.name} (${skill.hard ? "hard" : "not hard"})`,
    `   Idea: ${skill.description}`,
    `   Example: ${skill.example}`,
    `   Real life: ${skill.useCase}`,
  ].join("\n");
}

function formatScreen({
  screen,
  skills,
  position,
  shortAnswers,
}: {
  screen: LessonScreen;
  skills: readonly LessonSpecSkill[];
  position: number;
  shortAnswers: boolean;
}): string {
  const skillNames = screen.skills.flatMap((index) => skills[index]?.name ?? []);
  const kinds = getWrittenKinds({ kind: screen.kind, shortAnswers });

  return [
    `${position}. ${screen.kind}, written as: ${kinds.join(" or ")}`,
    `   Skills: ${skillNames.length > 0 ? skillNames.join("; ") : "none"}`,
    `   Brief: ${screen.brief}`,
    `   Visual: ${screen.visual ?? "none"}`,
    screen.activityTemplate &&
      (screen.kind === "explanation"
        ? `   Explore template: ${screen.activityTemplate}`
        : `   Activity template: ${screen.activityTemplate}`),
  ]
    .filter(Boolean)
    .join("\n");
}

function formatTemplates(templates: readonly LessonActivityTemplate[]): string {
  if (templates.length === 0) {
    return "none";
  }

  return templates
    .map(
      (template) =>
        `<template id="${template.id}">\n${template.description}\nJSON schema of the activity content: ${template.schema}\n</template>`,
    )
    .join("\n");
}

/**
 * Setup lessons say when their steps were written, since software changes fast; no other lesson
 * reads the date.
 */
function getToday(): string {
  return new Date().toISOString().slice(0, "yyyy-mm-dd".length);
}

export function formatLessonPlan(context: LessonWritingContext): string {
  const { spec } = context;

  const screens = spec.screens.map((screen, index) =>
    formatScreen({
      position: index + 1,
      screen,
      shortAnswers: Boolean(context.shortAnswers),
      skills: spec.skills,
    }),
  );

  return `
LANGUAGE: ${getPromptLanguageName({ language: context.language })}
${formatLocalContext(context.language)}
${formatCast({ language: context.language, seed: `${context.courseTitle}:${spec.title}` })}
LEVEL: ${context.level}${context.setup ? `\nTODAY: ${getToday()}` : ""}
COURSE_TITLE: ${context.courseTitle}
CHAPTER_TITLE: ${context.chapterTitle}
LESSON_TITLE: ${spec.title}
LESSON_DESCRIPTION: ${spec.description}
CAN_DO: ${spec.canDo}
SUPPORT_MODE: ${spec.supportMode}
${formatLessonExams(context.exams)}
CHAPTER_LESSONS: ${formatChapterLessons(context.chapterLessons)}

SKILLS:
${spec.skills.map((skill, index) => formatSkill(skill, index)).join("\n")}

SCREENS (${spec.screens.length}):
${screens.join("\n")}

ACTIVITY_TEMPLATES:
${formatTemplates(context.activityTemplates)}
${formatLessonDocuments({ material: context.material, sources: context.sources })}`;
}

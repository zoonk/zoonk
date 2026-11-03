import { formatCast } from "../_utils/cast";
import { type ChapterLesson, formatChapterLessons } from "../_utils/chapter-lessons";
import { formatLocalContext, formatMoneyContext } from "../_utils/language-context";
import { formatLessonDocuments } from "../_utils/lesson-documents";
import { type LessonExam, formatLessonExams } from "../_utils/lesson-exams";
import { getPromptLanguageName } from "../_utils/prompt-language";
import { type CourseLevel } from "../curriculum/_utils/course-levels";
import {
  type LessonScreen,
  type LessonSpec,
  type LessonSpecSkill,
} from "../lesson-spec/lesson-spec-rules";
import { type LessonVisualKind, findSharedPicture } from "../lesson-spec/lesson-visuals";
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

const DRAWN_VISUALS: Partial<Record<LessonVisualKind, string>> = {
  chart: "a chart the app draws, with the brief's data",
  table: "a table the app draws, with the brief's data",
  timeline: "a timeline the app draws, with the brief's dates",
};

/** The visual the plan chose, so the writer never has to guess it. */
function formatVisual({
  index,
  screen,
  screens,
}: {
  index: number;
  screen: LessonScreen;
  screens: readonly LessonScreen[];
}): string {
  const shared = findSharedPicture(screens, index);

  if (shared !== null) {
    return `   Visual: the picture of screen ${shared + 1} again, as its \`image\``;
  }

  const picture = `   Visual: ${screen.visual ? `a picture: ${screen.visual}` : "none"}`;

  if (screen.kind === "activity") {
    return `${picture}\n   Activity template: ${screen.activityTemplate}`;
  }

  if (screen.visualKind === "template") {
    return `   Explore template: ${screen.activityTemplate}`;
  }

  const drawn = DRAWN_VISUALS[screen.visualKind];

  return drawn ? `   Visual: ${drawn}` : picture;
}

function formatScreen({
  index,
  screen,
  screens,
  skills,
  shortAnswers,
}: {
  index: number;
  screen: LessonScreen;
  screens: readonly LessonScreen[];
  skills: readonly LessonSpecSkill[];
  shortAnswers: boolean;
}): string {
  const skillNames = screen.skills.flatMap((skill) => skills[skill]?.name ?? []);
  const kinds = getWrittenKinds({ kind: screen.kind, shortAnswers });

  return [
    `${index + 1}. ${screen.kind}, written as: ${kinds.join(" or ")}`,
    `   Skills: ${skillNames.length > 0 ? skillNames.join("; ") : "none"}`,
    `   Brief: ${screen.brief}`,
    formatVisual({ index, screen, screens }),
  ].join("\n");
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
      index,
      screen,
      screens: spec.screens,
      shortAnswers: Boolean(context.shortAnswers),
      skills: spec.skills,
    }),
  );

  return `
LANGUAGE: ${getPromptLanguageName({ language: context.language })}
${formatLocalContext(context.language)}
${formatMoneyContext(context.language)}
${formatCast({ language: context.language, seed: `${context.courseTitle}:${spec.title}` })}
LEVEL: ${context.level}${context.setup ? `\nTODAY: ${getToday()}` : ""}
COURSE_TITLE: ${context.courseTitle}
CHAPTER_TITLE: ${context.chapterTitle}
LESSON_TITLE: ${spec.title}
LESSON_DESCRIPTION: ${spec.description}
CAN_DO: ${spec.canDo}
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

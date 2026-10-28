import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../../provider-options";
import { formatCast } from "../../_utils/cast";
import { type ChapterLesson, formatChapterLessons } from "../../_utils/chapter-lessons";
import { draftAgainWhenFlawed } from "../../_utils/draft-again";
import { formatLocalContext } from "../../_utils/language-context";
import { formatLessonDocuments } from "../../_utils/lesson-documents";
import { type LessonExam, formatLessonExams } from "../../_utils/lesson-exams";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import { selectPromptVariants } from "../../_utils/prompt-variants";
import { type CourseLevel } from "../curriculum/_utils/course-levels";
import {
  LESSON_SCREEN_KINDS,
  type LessonSpec,
  type LessonSpecIssue,
  SUPPORT_MODES,
  getLessonSpecIssues,
} from "./lesson-spec-rules";
import systemPrompt from "./lesson-spec.prompt.md";
import { normalizeLessonSpec } from "./normalize-lesson-spec";
import quickLessonPrompt from "./quick-lesson.prompt.md";
import { splitLessonSpec } from "./split-lesson-spec";

/**
 * Sol leads the lesson-spec eval at close to the lowest cost; Haiku and Luna scored lower (7 Oct
 * 2026).
 */
const defaultModel = "openai/gpt-6-sol";
const fallbackModels = ["anthropic/claude-opus-5.5", "google/gemini-3.8-flash"] as const;

const skillSchema = z.object({
  description: z.string(),
  example: z.string(),
  hard: z.boolean(),
  name: z.string(),
  topic: z.string(),
  useCase: z.string(),
});

const screenSchema = z.object({
  activityTemplate: z.string().nullable(),
  brief: z.string(),
  kind: z.enum(LESSON_SCREEN_KINDS),
  skills: z.array(z.number().int()),
  visual: z.string().nullable(),
});

const lessonSchema = z.object({
  canDo: z.string(),
  description: z.string(),
  screens: z.array(screenSchema),
  skills: z.array(skillSchema),
  supportMode: z.enum(SUPPORT_MODES),
  title: z.string(),
});

const schema = z.object({ lessons: z.array(lessonSchema) });

type ActivityTemplateOption = { id: string; description: string; explore: boolean };

export type LessonSpecParams = {
  language: string;
  level: CourseLevel;
  courseTitle: string;
  chapterTitle: string;
  lessonTitle: string;
  lessonDescription: string;
  lessonCanDo?: string;
  skills?: string[];
  chapterLessons?: ChapterLesson[];
  activityTemplates: ActivityTemplateOption[];
  material?: string;
  sources?: string;
  exams?: LessonExam[];
  setup?: boolean;
  /** Otherwise the lesson plans only checks learners answer by picking. */
  shortAnswers?: boolean;
  /** One short lesson summing up a skill's core ideas, which is never split. */
  quick?: boolean;
  model?: string;
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

/** Several when the planned lesson didn't fit and was split; a quick one never is. */
type LessonSpecResult = { lessons: LessonSpec[] };

function formatList(items: readonly string[]): string {
  return items.length === 0 ? "none" : items.map((item) => `\n- ${item}`).join("");
}

function buildSystemPrompt(params: LessonSpecParams): string {
  const prompt = selectPromptVariants({
    template: systemPrompt,
    variants: {
      exams: (params.exams?.length ?? 0) > 0,
      material: Boolean(params.material),
      setup: Boolean(params.setup),
      shortAnswers: Boolean(params.shortAnswers),
      sources: Boolean(params.sources),
    },
  });

  return params.quick ? `${prompt}\n${quickLessonPrompt}` : prompt;
}

function buildUserPrompt(params: LessonSpecParams): string {
  const templates = params.activityTemplates.map((template) =>
    template.explore
      ? `${template.id} (explorable): ${template.description}`
      : `${template.id}: ${template.description}`,
  );

  return `
    LANGUAGE: ${getPromptLanguageName({ language: params.language })}
${formatLocalContext(params.language)}
    ${formatCast({ language: params.language, seed: `${params.courseTitle}:${params.lessonTitle}` })}
    LEVEL: ${params.level}
    COURSE_TITLE: ${params.courseTitle}
    CHAPTER_TITLE: ${params.chapterTitle}
    LESSON_TITLE: ${params.lessonTitle}
    LESSON_DESCRIPTION: ${params.lessonDescription}
    LESSON_CAN_DO: ${params.lessonCanDo ?? "none"}
    ${formatLessonExams(params.exams)}
    OUTLINE_SKILLS: ${formatList(params.skills ?? [])}
    CHAPTER_LESSONS: ${formatChapterLessons(params.chapterLessons)}
    ACTIVITY_TEMPLATES: ${formatList(templates)}
${formatLessonDocuments({ material: params.material, sources: params.sources })}  `;
}

async function planLesson(params: LessonSpecParams) {
  const { analytics, model = defaultModel, reasoning, serviceTier, useFallback = true } = params;
  const instructions = buildSystemPrompt(params);
  const userPrompt = buildUserPrompt(params);
  const providerOptions = buildProviderOptions({ fallbackModels, model, serviceTier, useFallback });
  const templateIds = new Set(params.activityTemplates.map((template) => template.id));

  const exploreIds = new Set(
    params.activityTemplates.flatMap((template) => (template.explore ? [template.id] : [])),
  );

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions,
        model,
        output: Output.object({ schema }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    libraryInput: true,
    systemPrompt: instructions,
    task: "lesson-spec",
  });

  const specs = result.output.lessons.map((raw) =>
    normalizeLessonSpec({ exploreIds, raw, templateIds }),
  );

  // A quick lesson is the one short lesson a learner chose instead of the skill's lessons.
  const lessons = params.quick
    ? specs.slice(0, 1)
    : specs.flatMap((spec) =>
        splitLessonSpec({ language: params.language, level: params.level, spec }),
      );

  const data: LessonSpecResult = { lessons };

  return { data, provenance, systemPrompt: instructions, usage: result.usage, userPrompt };
}

/**
 * Sizes are left to the split rule, which keeps a skill too big for one lesson whole on purpose.
 */
const REPLAN_ISSUES: ReadonlySet<LessonSpecIssue["code"]> = new Set([
  "application",
  "checkGap",
  "hook",
  "skillReference",
  "unpracticedSkill",
  "untaughtSkill",
  "workedExample",
]);

function countShapeIssues({ data, level }: { data: LessonSpecResult; level: CourseLevel }): number {
  return data.lessons
    .flatMap((spec) => getLessonSpecIssues({ level, spec }))
    .filter((issue) => REPLAN_ISSUES.has(issue.code)).length;
}

/**
 * A lesson that doesn't fit comes back as several. A plan that breaks a shape rule is planned once
 * more, and the one with fewer broken rules is kept.
 */
export function generateLessonSpec(params: LessonSpecParams) {
  return draftAgainWhenFlawed({
    countProblems: ({ data }) => countShapeIssues({ data, level: params.level }),
    draft: () => planLesson(params),
  });
}

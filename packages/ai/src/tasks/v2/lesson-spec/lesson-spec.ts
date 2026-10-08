import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../../provider-options";
import { formatCast } from "../../_utils/cast";
import { type ChapterLesson, formatChapterLessons } from "../../_utils/chapter-lessons";
import { formatLocalContext } from "../../_utils/language-context";
import { formatLessonDocuments } from "../../_utils/lesson-documents";
import { type LessonExam, formatLessonExams } from "../../_utils/lesson-exams";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import { type CourseLevel } from "../curriculum/_utils/course-levels";
import { LESSON_SCREEN_KINDS, type LessonSpec, SUPPORT_MODES } from "./lesson-spec-rules";
import systemPrompt from "./lesson-spec.prompt.md";
import { normalizeLessonSpec } from "./normalize-lesson-spec";
import { splitLessonSpec } from "./split-lesson-spec";

/**
 * From the lesson-spec eval (6 cases, code checks then Astra judge, 26 Sep
 * 2026): Sol 9.08, Opus 8.66 and Gemini 3.8 Flash 8.44, at $23, $100 and $17
 * per 1,000 runs. Sol leads on quality at close to the lowest cost. On 27 Sep, once plans put
 * one new term per screen, applied checks and hooks whose answer shows at once, Sol scored 9.21 on
 * five cases (9.41 before), and lessons written from those plans scored 8.85 (8.24 before).
 * The two cheapest, on 8 cases (7 Oct 2026): Claude Haiku 5.5 8.80 and Luna 8.65 against Sol's
 * 9.22, at $6 and $2 per 1,000 runs against $44.
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

/** One activity template from the player's catalog, with when it helps. */
type ActivityTemplateOption = { id: string; description: string };

export type LessonSpecParams = {
  language: string;
  level: CourseLevel;
  courseTitle: string;
  chapterTitle: string;
  lessonTitle: string;
  lessonDescription: string;
  lessonCanDo?: string;
  /** The skills the outline gave this lesson, as a starting point. */
  skills?: string[];
  /** The chapter's other lessons, so this one stays in its own scope and adds something new. */
  chapterLessons?: ChapterLesson[];
  activityTemplates: ActivityTemplateOption[];
  /** The pages of the learner's own material this lesson is built from, tagged with references. */
  material?: string;
  /** Excerpts of the public documents the lesson's facts come from, tagged with references. */
  sources?: string;
  /**
   * The exams the learners who study this shared lesson prepare for, so it's planned at their
   * depth and in their questions' style for their candidates, without naming them.
   */
  exams?: LessonExam[];
  model?: string;
  /** The gateway tier it answers at (see `ServiceTier`); the standard one when unset. */
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

/** Usually one lesson; several when the planned lesson didn't fit and was split. */
type LessonSpecResult = { lessons: LessonSpec[] };

function formatList(items: readonly string[]): string {
  return items.length === 0 ? "none" : items.map((item) => `\n- ${item}`).join("");
}

function buildUserPrompt(params: LessonSpecParams): string {
  const templates = params.activityTemplates.map(
    (template) => `${template.id}: ${template.description}`,
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

/**
 * Plans one lesson before it's written: its 1 to 3 skills, a screen plan of
 * 5 to 12 screens (hook, the idea in small steps, a check every 2 or 3 screens,
 * a worked example for hard skills and one application), where an activity or
 * a picture teaches, and whether it opens with the explanation or a question.
 * A lesson that doesn't fit comes back as several lessons: the model splits it
 * when it can, and the split rule enforces the size limits in code.
 */
export async function generateLessonSpec(params: LessonSpecParams) {
  const { analytics, model = defaultModel, reasoning, serviceTier, useFallback = true } = params;
  const userPrompt = buildUserPrompt(params);
  const providerOptions = buildProviderOptions({ fallbackModels, model, serviceTier, useFallback });
  const templateIds = new Set(params.activityTemplates.map((template) => template.id));

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    systemPrompt,
    task: "lesson-spec",
  });

  const lessons = result.output.lessons.flatMap((raw) =>
    splitLessonSpec({
      language: params.language,
      level: params.level,
      spec: normalizeLessonSpec({ raw, templateIds }),
    }),
  );

  const data: LessonSpecResult = { lessons };

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}

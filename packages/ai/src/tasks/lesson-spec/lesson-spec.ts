import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../provider-options";
import { formatCast } from "../_utils/cast";
import { type ChapterLesson, formatChapterLessons } from "../_utils/chapter-lessons";
import { draftAgainWhenFlawed } from "../_utils/draft-again";
import { formatLocalContext } from "../_utils/language-context";
import { formatLessonDocuments } from "../_utils/lesson-documents";
import { type LessonExam, formatLessonExams } from "../_utils/lesson-exams";
import { readsNoviceRules } from "../_utils/novice-rules";
import { type PromptProduct, formatProduct } from "../_utils/product";
import { getPromptLanguageName } from "../_utils/prompt-language";
import { selectPromptVariants } from "../_utils/prompt-variants";
import { getVerbForm } from "../_utils/verb-form";
import { type CourseLevel } from "../curriculum/_utils/course-levels";
import {
  LESSON_SCREEN_KINDS,
  type LessonSpec,
  type LessonSpecIssue,
  getLessonSpecIssues,
} from "./lesson-spec-rules";
import systemPrompt from "./lesson-spec.prompt.md";
import { LESSON_VISUAL_KINDS } from "./lesson-visuals";
import { normalizeLessonSpec } from "./normalize-lesson-spec";
import quickLessonPrompt from "./quick-lesson.prompt.md";
import { splitLessonSpec } from "./split-lesson-spec";

/**
 * The plan decides which screens show a visual. On 8 lessons across subjects and levels (4 Nov 2026),
 * with the same writer, Sol's plans scored 8.38 against Terra's 8.13, Opus's 8.00, Sonnet's 7.86
 * and Flash's 7.74, and 8.54 on visuals against Terra's 6.08: readers missed a visual on 5 to 14%
 * of screens instead of 18 to 31%, with 1 to 2% decorative. It costs about $0.06 a plan, Terra
 * $0.03. A learner's own lesson is planned by its scope's model (Luna).
 */
const defaultModel = "openai/gpt-6.1-sol";
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
  visualKind: z.enum(LESSON_VISUAL_KINDS),
});

const lessonSchema = z.object({
  canDo: z.string(),
  description: z.string(),
  screens: z.array(screenSchema),
  skills: z.array(skillSchema),
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
  /** The branded product a product course's lesson teaches people to use. */
  product?: PromptProduct | null;
  /** Built for one learner's own goal and never shared, so its pictures aren't reused. */
  isPrivate?: boolean;
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
  const novice = readsNoviceRules(params);

  const prompt = selectPromptVariants({
    template: systemPrompt,
    variants: {
      exams: (params.exams?.length ?? 0) > 0,
      material: Boolean(params.material),
      novice,
      private: Boolean(params.isPrivate || params.material),
      product: Boolean(params.product),
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
    VERB_FORM: ${getVerbForm(params.language)}
${formatLocalContext(params.language)}
    ${formatCast({ language: params.language, seed: `${params.courseTitle}:${params.lessonTitle}` })}
    LEVEL: ${params.level}
    COURSE_TITLE: ${params.courseTitle}${params.product ? `\n    ${formatProduct(params.product)}` : ""}
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
  "earlyCheck",
  "guess",
  "hook",
  "skillReference",
  "unpracticedSkill",
  "untaughtSkill",
  "workedExample",
]);

function countShapeIssues({
  data,
  level,
  novice,
}: {
  data: LessonSpecResult;
  level: CourseLevel;
  novice: boolean;
}): number {
  return data.lessons
    .flatMap((spec) => getLessonSpecIssues({ level, novice, spec }))
    .filter((issue) => REPLAN_ISSUES.has(issue.code)).length;
}

/**
 * A lesson that doesn't fit comes back as several. A plan that breaks a shape rule is planned once
 * more, and the one with fewer broken rules is kept.
 */
export async function generateLessonSpec(params: LessonSpecParams) {
  return draftAgainWhenFlawed({
    countProblems: ({ data }) =>
      countShapeIssues({ data, level: params.level, novice: readsNoviceRules(params) }),
    draft: () => planLesson(params),
  });
}

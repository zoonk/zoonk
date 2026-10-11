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

/**
 * One activity template from the player's catalog, with when it helps, and whether an explanation
 * screen can show it to explore.
 */
type ActivityTemplateOption = { id: string; description: string; explore: boolean };

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
  /** A lesson that sets up a tool on the learner's device ("Set up Python on Windows"). */
  setup?: boolean;
  /**
   * A skill's quick lesson ("Quick lesson"): one short lesson summing up the skill's core ideas with
   * one worked example, for a learner who takes a short version of a base. It's never split.
   */
  quick?: boolean;
  model?: string;
  /** The gateway tier it answers at (see `ServiceTier`); the standard one when unset. */
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

/** Usually one lesson; several when the planned lesson didn't fit and was split (never a quick one). */
type LessonSpecResult = { lessons: LessonSpec[] };

function formatList(items: readonly string[]): string {
  return items.length === 0 ? "none" : items.map((item) => `\n- ${item}`).join("");
}

/**
 * The rules, keeping in place only the variants this lesson is (planned for exams, from the
 * learner's material or official sources, a setup lesson), then a quick lesson's rules last. A
 * lesson never reads the others' rules, so its prompt (and version) never carries them, and a
 * variant's lesson reads its rules where they always were.
 */
function buildSystemPrompt(params: LessonSpecParams): string {
  const prompt = selectPromptVariants({
    template: systemPrompt,
    variants: {
      exams: (params.exams?.length ?? 0) > 0,
      material: Boolean(params.material),
      setup: Boolean(params.setup),
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

/** One call planning the lesson, normalized and split. */
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
 * The shape rules a new plan can meet: a hook first, a check every 2 or 3 screens, one application
 * last, and every skill taught, practiced and, when hard, worked through. Sizes are the split
 * rule's, which keeps a skill too big for one lesson whole on purpose.
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
 * Plans one lesson before it's written: its 1 to 3 skills, a screen plan of
 * 5 to 12 screens (hook, the idea in small steps, a check every 2 or 3 screens,
 * a worked example for hard skills and one application), where an activity or
 * a picture teaches, and whether it opens with the explanation or a question.
 * A lesson that doesn't fit comes back as several lessons: the model splits it
 * when it can, and the split rule enforces the size limits in code. A plan
 * that breaks a shape rule (`getLessonSpecIssues`, such as four teaching
 * screens in a row) is planned once more, and the plan with fewer broken rules
 * is kept (`draftAgainWhenFlawed`).
 */
export function generateLessonSpec(params: LessonSpecParams) {
  return draftAgainWhenFlawed({
    countProblems: ({ data }) => countShapeIssues({ data, level: params.level }),
    draft: () => planLesson(params),
  });
}

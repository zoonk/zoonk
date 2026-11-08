import "server-only";
import { Output, streamText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type TaskProvenance } from "../../provenance/task-provenance";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../provider-options";
import { getPromptLanguageName } from "../_utils/prompt-language";
import { getVerbForm } from "../_utils/verb-form";
import { COURSE_LEVELS } from "./_utils/course-levels";
import { normalizeDraft } from "./_utils/graph-drafts";
import { type ExamLibrary } from "./_utils/library-skills";
import { type GraphFrameSection } from "./_utils/skill-graph-sections";
import { type OnSkillNamed, finishStreamedPart } from "./_utils/streamed-skill-names";
import { type ExamOutline, formatExamOutline } from "./exam-outline";
import { buildSkillGraphSystemPrompt, startsWithSubject } from "./skill-graph-system-prompt";

/**
 * Terra scored a little above Sol on the skill-graph eval at half the cost (30 Oct 2026); Flash
 * missed whole areas on huge goals, so it's only the last fallback.
 */
const defaultModel = "openai/gpt-6.1-terra";
const fallbackModels = ["anthropic/claude-opus-5.5", "google/gemini-3.8-flash"] as const;

export const courseSchema = z.object({
  key: z.string(),
  levels: z.array(z.enum(COURSE_LEVELS)),
  title: z.string(),
});

const phaseSchema = z.object({ milestone: z.string(), title: z.string() });

export const skillSchema = z.object({
  area: z.string(),
  course: z.string(),
  description: z.string(),
  estimatedLessons: z.number(),
  examWeight: z.number().nullable(),
  key: z.string(),
  level: z.enum(COURSE_LEVELS),
  name: z.string(),
  outcome: z.boolean(),
  phase: z.number(),
  prerequisites: z.array(z.string()),
  topics: z.array(z.string()),
});

const schema = z.object({
  courses: z.array(courseSchema),
  phases: z.array(phaseSchema),
  skills: z.array(skillSchema),
});

const subjectStartSchema = schema.extend({
  courses: z.array(courseSchema.extend({ supporting: z.boolean() })),
});

const frameSchema = z.object({
  courses: z.array(courseSchema),
  phases: z.array(phaseSchema),
  sections: z.array(
    z.object({
      area: z.string(),
      course: z.string(),
      estimatedLessons: z.number(),
      phases: z.array(z.number()),
      skills: z.number(),
      subject: z.string(),
    }),
  ),
});

const sectionSchema = z.object({ skills: z.array(skillSchema) });

const librarySectionSchema = z.object({
  skills: z.array(skillSchema.extend({ reuse: z.string().nullable() })),
});

type GraphFrame = z.infer<typeof frameSchema>;

export { type ExamLibrary, type LibrarySkill } from "./_utils/library-skills";

export type SkillGraphParams = {
  language: string;
  /**
   * The learner's words only for their own private course; a shared graph gets the goal's general
   * form (`toScopedGraphPrompt` in core), since it serves other learners.
   */
  goal: string;
  goalKind: "learn" | "exam" | "language";
  purpose?: "overview" | "deep" | "work" | "careerChange" | "refresh";
  ownLevel?: "none" | "basic" | "intermediate" | "advanced";
  context?: string;
  /** The graph's areas and topics are the notice's own, word for word. */
  examBlueprint?: ExamOutline;
  targetLanguage?: string;
  hasMaterial?: boolean;
  /** For a test from the learner's own material days away: the most lessons its days hold. */
  lessonBudget?: number | null;
  /** The branded product the goal is about, and the exact title of the course that teaches it. */
  product?: { brand: string; courseTitle: string; name: string } | null;
  librarySkills?: boolean;
  model?: string;
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
  /**
   * Each skill's name once the model finished writing it; a redraft or a retry names skills again.
   * A callback that fails is ignored.
   */
  onSkillNamed?: OnSkillNamed;
  /**
   * For an exam graph other exams share: the skills they already use in the frame's courses, read
   * once the frame names them, so the sections reuse those skills instead of cutting them anew.
   */
  findLibrarySkills?: (frame: {
    courses: readonly { key: string; title: string }[];
    provenance: TaskProvenance;
  }) => Promise<ExamLibrary>;
};

type GraphPart =
  | { kind: "frame" }
  | {
      frame: GraphFrame;
      kind: "skills";
      library: string | null;
      sections: readonly GraphFrameSection[];
    }
  | { kind: "whole" };

function formatFrameSection(section: GraphFrameSection): string {
  const subject = section.subject ? `${section.subject} ` : "";
  return `- ${subject}${section.area}: course ${section.course}, phases ${section.phases.join(", ")}, about ${section.skills} skills and ${section.estimatedLessons} lessons`;
}

function formatSkillsPart({
  frame,
  library,
  sections,
}: {
  frame: GraphFrame;
  library: string | null;
  sections: readonly GraphFrameSection[];
}): string {
  const courses = frame.courses.map(
    (course) => `- ${course.key}: ${course.title} (${course.levels.join(", ")})`,
  );

  const phases = frame.phases.map(
    (phase, index) => `- ${index + 1}. ${phase.title}: ${phase.milestone}`,
  );

  return [
    "FRAME:",
    `COURSES:\n${courses.join("\n")}`,
    `PHASES:\n${phases.join("\n")}`,
    `SECTIONS:\n${frame.sections.map((section) => formatFrameSection(section)).join("\n")}`,
    library,
    `WRITE:\n${sections.map((section) => formatFrameSection(section)).join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Goes after everything every call of the graph shares, so the shared beginning is cached. */
function formatPart(part: GraphPart): string {
  if (part.kind === "skills") {
    return `SECTION: skills\n${formatSkillsPart(part)}`;
  }

  return `SECTION: ${part.kind}`;
}

function formatTargetLanguage(params: SkillGraphParams): string {
  return params.targetLanguage
    ? getPromptLanguageName({ language: params.targetLanguage, userLanguage: params.language })
    : "none";
}

function formatGoalInputs(params: SkillGraphParams): string {
  const exam = params.goalKind === "exam";
  const blueprint = params.examBlueprint ? `\n${formatExamOutline(params.examBlueprint)}` : "none";

  return [
    `LANGUAGE: ${getPromptLanguageName({ language: params.language })}`,
    `VERB_FORM: ${getVerbForm(params.language)}`,
    `GOAL_KIND: ${params.goalKind}`,
    params.goalKind === "learn" && `PURPOSE: ${params.purpose ?? "none"}`,
    `OWN_LEVEL: ${params.ownLevel ?? "none given"}`,
    params.goalKind === "language" && `TARGET_LANGUAGE: ${formatTargetLanguage(params)}`,
    params.lessonBudget && `LESSON_BUDGET: ${params.lessonBudget}`,
    params.product && `PRODUCT: ${params.product.name} by ${params.product.brand}`,
    params.product && `PRODUCT_COURSE: ${params.product.courseTitle}`,
    exam && `EXAM_BLUEPRINT: ${blueprint}`,
  ]
    .filter(Boolean)
    .map((line) => `    ${line}`)
    .join("\n");
}

function buildUserPrompt({ params, part }: { params: SkillGraphParams; part: GraphPart }): string {
  const learnerInput = formatUntrustedInput({
    CONTEXT: params.context?.trim() || "none",
    GOAL: params.goal,
  });

  const parts = [
    formatGoalInputs(params),
    learnerInput,
    params.goalKind === "exam" && formatPart(part),
  ].filter(Boolean);

  return `\n${parts.join("\n\n")}\n  `;
}

/** What a call that writes part of a learn goal's path reads about the goal, as the graph reads it. */
export function formatGoalPrompt(params: SkillGraphParams): string {
  return buildUserPrompt({ params, part: { kind: "whole" } });
}

async function writePart<TOutput>({
  params,
  part,
  partSchema,
}: {
  params: SkillGraphParams;
  part: GraphPart;
  partSchema: z.ZodType<TOutput>;
}) {
  const { analytics, model = defaultModel, reasoning, serviceTier, useFallback = true } = params;
  const systemPrompt = buildSkillGraphSystemPrompt(params);
  const userPrompt = buildUserPrompt({ params, part });
  const providerOptions = buildProviderOptions({ fallbackModels, model, serviceTier, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () => {
      // A failed stream rejects with the SDK's `NoOutputGeneratedError`. The provider's error is the
      // real cause, and the SDK's default handler would log it with the learner's prompt.
      const streamErrors: unknown[] = [];

      return finishStreamedPart({
        generation: streamText({
          instructions: systemPrompt,
          model,
          onError: ({ error }) => {
            streamErrors.push(error);
          },
          output: Output.object({ schema: partSchema }),
          prompt: userPrompt,
          providerOptions,
          reasoning,
        }),
        onSkillNamed: params.onSkillNamed,
      }).catch((error: unknown) => {
        throw streamErrors[0] ?? error;
      });
    },
    libraryInput: true,
    systemPrompt,
    task: "skill-graph",
  });

  return { output: result.output, provenance, systemPrompt, usage: result.usage, userPrompt };
}

export async function generateWholeSkillGraph(params: SkillGraphParams) {
  const whole = await writePart({
    params,
    part: { kind: "whole" },
    partSchema: startsWithSubject(params) ? subjectStartSchema : schema,
  });

  return {
    ...normalizeDraft({ params, raw: whole.output }),
    provenance: whole.provenance,
    systemPrompt: whole.systemPrompt,
    usage: whole.usage,
    userPrompt: whole.userPrompt,
  };
}

export type SkillsPart = Omit<Extract<GraphPart, { kind: "skills" }>, "kind">;

export function generateSkillGraphFrame(params: SkillGraphParams) {
  return writePart({ params, part: { kind: "frame" }, partSchema: frameSchema });
}

export function generateSkillGraphSection({
  params,
  part,
}: {
  params: SkillGraphParams;
  part: SkillsPart;
}) {
  return part.library === null
    ? writePart({ params, part: { ...part, kind: "skills" }, partSchema: sectionSchema })
    : writePart({ params, part: { ...part, kind: "skills" }, partSchema: librarySectionSchema });
}

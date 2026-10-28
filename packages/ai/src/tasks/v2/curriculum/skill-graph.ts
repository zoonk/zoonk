import "server-only";
import { randomUUID } from "node:crypto";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { combineTaskProvenance, sumLanguageModelUsage } from "../../../provenance/task-provenance";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../../provider-options";
import { draftAgainWhenFlawed } from "../../_utils/draft-again";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import { COURSE_LEVELS } from "./_utils/course-levels";
import { findRedraftProblems, normalizeDraft, redraftFlawedSections } from "./_utils/graph-drafts";
import { EmptySkillGraphError } from "./_utils/normalize-skill-graph";
import {
  type GraphFrameSection,
  shouldWriteInSections,
  toSectionCalls,
} from "./_utils/skill-graph-sections";
import { type ExamOutline, formatExamOutline } from "./exam-outline";
import { buildSkillGraphSystemPrompt } from "./skill-graph-system-prompt";

/**
 * Sol scored within Opus's margin on the skill-graph eval at under a third of the cost (26 Sep
 * 2026); Flash missed whole areas on huge goals, so it's only the last fallback.
 */
const defaultModel = "openai/gpt-6-sol";
const fallbackModels = ["anthropic/claude-opus-5.5", "google/gemini-3.8-flash"] as const;

const courseSchema = z.object({
  key: z.string(),
  levels: z.array(z.enum(COURSE_LEVELS)),
  title: z.string(),
});

const phaseSchema = z.object({ milestone: z.string(), title: z.string() });

const skillSchema = z.object({
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

type GraphFrame = z.infer<typeof frameSchema>;

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
  model?: string;
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

type GraphPart =
  | { kind: "frame" }
  | { frame: GraphFrame; kind: "skills"; sections: readonly GraphFrameSection[] }
  | { kind: "whole" };

function formatFrameSection(section: GraphFrameSection): string {
  const subject = section.subject ? `${section.subject} ` : "";
  return `- ${subject}${section.area}: course ${section.course}, phases ${section.phases.join(", ")}, about ${section.skills} skills and ${section.estimatedLessons} lessons`;
}

function formatSkillsPart({
  frame,
  sections,
}: {
  frame: GraphFrame;
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
    `WRITE:\n${sections.map((section) => formatFrameSection(section)).join("\n")}`,
  ].join("\n");
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
    `GOAL_KIND: ${params.goalKind}`,
    params.goalKind === "learn" && `PURPOSE: ${params.purpose ?? "none"}`,
    `OWN_LEVEL: ${params.ownLevel ?? "none given"}`,
    params.goalKind === "language" && `TARGET_LANGUAGE: ${formatTargetLanguage(params)}`,
    params.lessonBudget && `LESSON_BUDGET: ${params.lessonBudget}`,
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
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema: partSchema }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    libraryInput: true,
    systemPrompt,
    task: "skill-graph",
  });

  return { output: result.output, provenance, systemPrompt, usage: result.usage, userPrompt };
}

async function generateWholeGraph(params: SkillGraphParams) {
  const whole = await writePart({ params, part: { kind: "whole" }, partSchema: schema });

  return {
    ...normalizeDraft({ params, raw: whole.output }),
    provenance: whole.provenance,
    systemPrompt: whole.systemPrompt,
    usage: whole.usage,
    userPrompt: whole.userPrompt,
  };
}

function generateCheckedWholeGraph(params: SkillGraphParams) {
  return draftAgainWhenFlawed({
    countProblems: ({ data }) => findRedraftProblems({ data, params }).length,
    draft: () => generateWholeGraph(params),
  });
}

/** One more try right away for a section: the learner waits on the whole graph. */
async function writeSkills({
  frame,
  params,
  sections,
}: {
  frame: GraphFrame;
  params: SkillGraphParams;
  sections: readonly GraphFrameSection[];
}) {
  const part: GraphPart = { frame, kind: "skills", sections };

  return writePart({ params, part, partSchema: sectionSchema }).catch(() =>
    writePart({ params, part, partSchema: sectionSchema }),
  );
}

/**
 * Written in sections at once, so it takes about as long as its largest part (a public-service
 * exam's 13,500 tokens took three minutes in one call).
 */
async function generateSectionedGraph(params: SkillGraphParams) {
  // The calls are one job, so they share a trace unless the caller's job already has one.
  const analytics = { ...params.analytics, traceId: params.analytics?.traceId ?? randomUUID() };
  const shared = { ...params, analytics };

  const frame = await writePart({
    params: shared,
    part: { kind: "frame" },
    partSchema: frameSchema,
  });

  const calls = toSectionCalls(frame.output.sections);

  if (calls.length === 0) {
    return generateCheckedWholeGraph(params);
  }

  const written = await Promise.all(
    calls.map((sections) => writeSkills({ frame: frame.output, params: shared, sections })),
  );

  const { rewrites, ...draft } = await redraftFlawedSections({
    frame: frame.output,
    params: shared,
    rewrite: (index) =>
      writePart({
        params: shared,
        part: { frame: frame.output, kind: "skills", sections: calls[index] ?? [] },
        partSchema: sectionSchema,
      }),
    written,
  });

  const parts = [frame, ...written, ...rewrites];

  return {
    ...draft,
    provenance: combineTaskProvenance(parts.map((part) => part.provenance)),
    systemPrompt: frame.systemPrompt,
    usage: sumLanguageModelUsage(parts.map((part) => part.usage)),
    userPrompt: parts.map((part) => part.userPrompt).join("\n"),
  };
}

/**
 * Code repairs what it can and reports it in `repaired`. A graph it still finds flawed is written
 * once more; a big exam's only in its flawed sections, unless the flaw is in its phases.
 */
export function generateSkillGraph(params: SkillGraphParams) {
  if (!shouldWriteInSections(params)) {
    return generateCheckedWholeGraph(params);
  }

  return draftAgainWhenFlawed({
    countProblems: ({ data }) =>
      findRedraftProblems({ data, params }).filter((problem) => problem.keys.length === 0).length,
    draft: () => generateSectionedGraph(params),
  });
}

export function isEmptySkillGraphError(error: unknown): boolean {
  return error instanceof EmptySkillGraphError;
}

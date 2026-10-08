import "server-only";
import { randomUUID } from "node:crypto";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { combineTaskProvenance, sumLanguageModelUsage } from "../../../provenance/task-provenance";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import { COURSE_LEVELS } from "./_utils/course-levels";
import {
  EmptySkillGraphError,
  type RawSkillGraph,
  type SkillGraph,
  normalizeSkillGraph,
} from "./_utils/normalize-skill-graph";
import {
  type GraphFrameSection,
  joinSections,
  shouldWriteInSections,
  toSectionCalls,
} from "./_utils/skill-graph-sections";
import { type ExamOutline, formatExamOutline } from "./exam-outline";
import systemPrompt from "./skill-graph.prompt.md";

/**
 * From the skill-graph eval (6 cases, Astra judge, 26 Sep 2026): Opus 8.38,
 * Sol 8.29 and Gemini 3.8 Flash 7.57, at $236, $72 and $13 per 1,000 runs.
 * Sol is within the margin of Opus at under a third of the cost and faster;
 * Flash missed whole areas on huge goals, so it's only the last fallback.
 * Every model under-sized big goals, so the prompt gained size calibration;
 * Sol then scored 8.47 with honest totals (quantum physics from zero: 363 h).
 * Exam graphs put school subjects in the beginner band, so adults and students
 * finishing school opened on elementary chapters; with the level bands and the
 * schooling floor, Sol put ENEM and Polícia Federal Portuguese at intermediate
 * with no elementary skills (27 Sep: 7.9 and 8.3 on those two cases).
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

/** A big exam's frame: its courses and phases, and the section each subject is written in. */
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

/** The skills of a few of a big exam's sections. */
const sectionSchema = z.object({ skills: z.array(skillSchema) });

type GraphFrame = z.infer<typeof frameSchema>;

export type SkillGraphParams = {
  language: string;
  /** The goal in the learner's words. */
  goal: string;
  goalKind: "learn" | "exam" | "language";
  /** Why a learn goal: an overview, depth, work, a career change or a refresh. */
  purpose?: "overview" | "deep" | "work" | "careerChange" | "refresh";
  /** Where the learner says they are before placement. */
  ownLevel?: "none" | "basic" | "intermediate" | "advanced";
  /** Anything else the learner said: role, tasks, tools, reason, date, their material. */
  context?: string;
  /**
   * The exam's notice: its subjects with every topic, its notes on format and scoring, and how
   * often the board asks each topic. The graph's areas and topics are its own, word for word.
   */
  examBlueprint?: ExamOutline;
  /** The language being learned, for language goals. */
  targetLanguage?: string;
  /**
   * For a test from the learner's own material days away: the most lessons its days hold. The
   * graph is sized by the material up to it, a skill for each of the material's topics, before
   * the learner picks a daily time.
   */
  lessonBudget?: number | null;
  model?: string;
  /** The gateway tier it answers at (see `ServiceTier`); the standard one when unset. */
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

/** What one call of a graph writes: all of it, a big exam's frame, or some of its sections. */
type GraphPart =
  | { kind: "frame" }
  | { frame: GraphFrame; kind: "skills"; sections: readonly GraphFrameSection[] }
  | { kind: "whole" };

function formatFrameSection(section: GraphFrameSection): string {
  const subject = section.subject ? `${section.subject} ` : "";
  return `- ${subject}${section.area}: course ${section.course}, phases ${section.phases.join(", ")}, about ${section.skills} skills and ${section.estimatedLessons} lessons`;
}

/** The frame the skills calls follow, and the sections one of them writes. */
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

/**
 * The part of the graph a call writes, after everything every call of the graph shares, so the
 * shared beginning can be cached.
 */
function formatPart(part: GraphPart): string {
  if (part.kind === "skills") {
    return `SECTION: skills\n${formatSkillsPart(part)}`;
  }

  return `SECTION: ${part.kind}`;
}

function buildUserPrompt({ params, part }: { params: SkillGraphParams; part: GraphPart }): string {
  const learnerInput = formatUntrustedInput({
    CONTEXT: params.context?.trim() || "none",
    GOAL: params.goal,
  });

  const targetLanguage = params.targetLanguage
    ? getPromptLanguageName({ language: params.targetLanguage, userLanguage: params.language })
    : "none";

  return `
    LANGUAGE: ${getPromptLanguageName({ language: params.language })}
    GOAL_KIND: ${params.goalKind}
    PURPOSE: ${params.purpose ?? "none"}
    OWN_LEVEL: ${params.ownLevel ?? "none given"}
    TARGET_LANGUAGE: ${targetLanguage}
    LESSON_BUDGET: ${params.lessonBudget ?? "none"}
    EXAM_BLUEPRINT: ${params.examBlueprint ? `\n${formatExamOutline(params.examBlueprint)}` : "none"}

${learnerInput}

${formatPart(part)}
  `;
}

/** Writes one part of the graph in one call. */
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
    systemPrompt,
    task: "skill-graph",
  });

  return { output: result.output, provenance, usage: result.usage, userPrompt };
}

/** The whole graph in one call. */
async function generateWholeGraph(params: SkillGraphParams) {
  const whole = await writePart({ params, part: { kind: "whole" }, partSchema: schema });

  const data: SkillGraph = normalizeSkillGraph(
    whole.output,
    params.examBlueprint,
    params.lessonBudget,
  );

  return {
    data,
    provenance: whole.provenance,
    systemPrompt,
    usage: whole.usage,
    userPrompt: whole.userPrompt,
  };
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
 * A big exam's graph, written in sections at once: one call writes the frame (courses, phases and
 * each subject's phases and size), then a few calls write the skills of a few subjects each, so
 * the graph takes about as long as its largest part instead of all of its output in a row (a
 * public-service exam's 13,500 tokens took three minutes in one call at the standard tier).
 * The parts join into one graph: a skill that builds on another section's subject names that
 * subject's topic, which becomes the skill that teaches it (`joinSections`).
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
    return generateWholeGraph(params);
  }

  const written = await Promise.all(
    calls.map((sections) => writeSkills({ frame: frame.output, params: shared, sections })),
  );

  const raw: RawSkillGraph = {
    courses: frame.output.courses,
    phases: frame.output.phases,
    skills: joinSections(written.map((call) => call.output.skills)),
  };

  const parts = [frame, ...written];

  return {
    data: normalizeSkillGraph(raw, params.examBlueprint, params.lessonBudget),
    provenance: combineTaskProvenance(parts.map((part) => part.provenance)),
    systemPrompt,
    usage: sumLanguageModelUsage(parts.map((part) => part.usage)),
    userPrompt: parts.map((part) => part.userPrompt).join("\n"),
  };
}

/**
 * Turns a goal into its skill graph: the skills it needs with their
 * prerequisites, the Library courses and level bands that teach them, and
 * the phases the learner goes through, each sized in hours of study rather
 * than dates. Huge goals span several courses; exam goals follow and weight
 * the blueprint when one is given, each skill in one of its subjects with the
 * topics it teaches, in the notice's words. A big exam's graph is written in
 * sections at once (`generateSectionedGraph`).
 */
export function generateSkillGraph(params: SkillGraphParams) {
  return shouldWriteInSections(params)
    ? generateSectionedGraph(params)
    : generateWholeGraph(params);
}

/** Whether a graph failed because the model answered with nothing to plan from. */
export function isEmptySkillGraphError(error: unknown): boolean {
  return error instanceof EmptySkillGraphError;
}

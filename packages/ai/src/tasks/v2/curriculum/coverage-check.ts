import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import { selectPromptVariants } from "../../_utils/prompt-variants";
import {
  type CoverageReference,
  type ExamWeightChange,
  type MissingSkill,
  type SkillPlacement,
  normalizeCoverage,
  normalizeExamWeights,
  normalizePlacements,
} from "./_utils/normalize-coverage";
import template from "./coverage-check.prompt.md";
import {
  type ExamOutline,
  findUncoveredTopics,
  formatExamOutline,
  getTopicId,
} from "./exam-outline";

/**
 * From the coverage-check eval (6 cases, code-scored, 7 Oct 2026): Sonnet 5.5, Opus 5.5 and
 * Gemini 3.8 Flash found every planted gap with no false alarms (10.0). Sonnet answers in 5.1s
 * (p50, 7.4s p95) at $11 per 1,000 runs; Flash's reasoning runs away now and then (25s p95 here,
 * 464s at medium reasoning, and 158s to 248s on real goals, where the learner waits on it before
 * placement), and at low reasoning it missed a notice's topic. Opus matches Sonnet at twice the
 * price.
 */
const defaultModel = "anthropic/claude-sonnet-5.5";
const fallbackModels = ["google/gemini-3.8-flash", "openai/gpt-6-sol"] as const;

const examWeightsSchema = z.array(z.object({ examWeight: z.number(), key: z.string() }));

/** Any goal's check: only the skills the graph is missing. */
const schema = z.object({
  missing: z.array(
    z.object({
      description: z.string(),
      name: z.string(),
      prerequisites: z.array(z.string()),
      syllabusLine: z.string(),
    }),
  ),
});

/** An exam's check also weighs the missing skills and corrects the graph's weights. */
const examSchema = z.object({
  examWeights: examWeightsSchema,
  missing: z.array(
    z.object({
      description: z.string(),
      examWeight: z.number().nullable(),
      name: z.string(),
      prerequisites: z.array(z.string()),
      syllabusLine: z.string(),
    }),
  ),
});

/** With the exam's notice, it also places the missing skills and the graph's in the notice. */
const noticeSchema = z.object({
  examWeights: examWeightsSchema,
  missing: z.array(
    z.object({
      area: z.string(),
      description: z.string(),
      examWeight: z.number().nullable(),
      name: z.string(),
      prerequisites: z.array(z.string()),
      syllabusLine: z.string(),
      topics: z.array(z.string()),
    }),
  ),
  placements: z.array(z.object({ area: z.string(), key: z.string(), topics: z.array(z.string()) })),
});

/** What any of the three answers, with the fields a goal's check doesn't ask for left out. */
type RawCoverage = {
  examWeights?: ExamWeightChange[];
  missing: {
    area?: string;
    description: string;
    examWeight?: number | null;
    name: string;
    prerequisites: string[];
    syllabusLine: string;
    topics?: string[];
  }[];
  placements?: SkillPlacement[];
};

type CoverageSkill = {
  key: string;
  name: string;
  description: string;
  /** For an exam: how much of it depends on the skill, from 1 to 5. */
  examWeight?: number | null;
  /** For an exam with a notice: the subject the graph put it in, and the notice topics it teaches. */
  area?: string | null;
  topics?: string[];
};

export type CoverageCheckParams = {
  language: string;
  goal: string;
  /** An exam's check also weighs its skills against the references. */
  goalKind: "exam" | "language" | "learn";
  skills: CoverageSkill[];
  /** Reference syllabi, official curricula or exam notices, as extracted text. */
  references: CoverageReference[];
  /**
   * An exam's notice: every skill is placed in its subjects and topics, and every topic no skill
   * teaches gets one.
   */
  examOutline?: ExamOutline;
  model?: string;
  /** The gateway tier it answers at (see `ServiceTier`); the standard one when unset. */
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

type CoverageCheckResult = {
  /** For an exam: the skills already in the graph whose weight the references show is off. */
  examWeights: ExamWeightChange[];
  missing: MissingSkill[];
  /** For an exam with a notice: the graph's skills whose subject or topics change. */
  placements: SkillPlacement[];
};

function formatPlace({ outline, skill }: { outline: ExamOutline; skill: CoverageSkill }): string {
  const topics = (skill.topics ?? []).flatMap(
    (topic) => getTopicId({ outline, subject: skill.area ?? "", topic }) ?? [],
  );

  return ` [area: ${skill.area || "none"}; topics: ${topics.join(", ") || "none"}]`;
}

function formatSkill({ outline, skill }: { outline?: ExamOutline; skill: CoverageSkill }): string {
  const line = `- ${skill.key}: ${skill.name}. ${skill.description}`;
  const place = outline ? formatPlace({ outline, skill }) : "";
  const weight = typeof skill.examWeight === "number" ? ` (exam weight ${skill.examWeight})` : "";

  return `${line}${place}${weight}`;
}

/** An exam's notice, which the check places the graph in; never another goal's. */
function getNoticeOutline(params: CoverageCheckParams): ExamOutline | undefined {
  return params.goalKind === "exam" ? params.examOutline : undefined;
}

/**
 * Which instructions and answer a check gets: an exam's weighs its skills, and with its notice also
 * places them in it, so another goal's check never reads the rules or fills the fields of either.
 */
function toPromptVariants(params: CoverageCheckParams) {
  return { exam: params.goalKind === "exam", notice: Boolean(getNoticeOutline(params)) };
}

function getSchema(params: CoverageCheckParams): z.ZodType<RawCoverage> {
  const variants = toPromptVariants(params);

  if (variants.notice) {
    return noticeSchema;
  }

  return variants.exam ? examSchema : schema;
}

function formatUncovered(params: CoverageCheckParams): string {
  const outline = getNoticeOutline(params);

  if (!outline) {
    return "";
  }

  const uncovered = findUncoveredTopics({
    outline,
    skills: params.skills.map((skill) => ({
      area: skill.area ?? null,
      topics: skill.topics ?? [],
    })),
  }).map((item) => `- ${getTopicId({ outline, ...item })} ${item.topic}`);

  return `
    EXAM_NOTICE:
${formatExamOutline(outline)}

    UNCOVERED_TOPICS:
${uncovered.join("\n") || "none"}
`;
}

function buildUserPrompt(params: CoverageCheckParams): string {
  const outline = getNoticeOutline(params);

  const untrusted = formatUntrustedInput({
    GOAL: params.goal,
    ...Object.fromEntries(
      params.references.map((reference, index) => [
        `REFERENCE_${index + 1}`,
        `${reference.title}\n\n${reference.text}`,
      ]),
    ),
  });

  return `
    LANGUAGE: ${getPromptLanguageName({ language: params.language })}
    GOAL_KIND: ${params.goalKind}
    SKILLS:
${params.skills.map((skill) => formatSkill({ outline, skill })).join("\n")}
${formatUncovered(params)}
${untrusted}
  `;
}

/**
 * Compares a skill graph with reference syllabi (university courses, official
 * curricula, exam notices) and returns the skills the references expect but
 * the graph misses, each with the syllabus line it comes from and where it
 * fits in the graph. For an exam, it also weighs them: each missing skill's
 * exam weight, and the graph's skills whose weight the notice's areas and
 * topic frequency show is off. With an exam's notice, it places the graph in
 * it: each skill in its subject with the topics it teaches, and a new skill
 * for every topic none teaches. Goals check their graph with it once research
 * found their references, an exam's graph when its notice has topics no skill
 * covers, and an exam's plan once research read its notice.
 */
export async function checkCoverage(params: CoverageCheckParams) {
  const { analytics, model = defaultModel, reasoning, serviceTier, useFallback = true } = params;
  const systemPrompt = selectPromptVariants({ template, variants: toPromptVariants(params) });
  const userPrompt = buildUserPrompt(params);
  const providerOptions = buildProviderOptions({ fallbackModels, model, serviceTier, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema: getSchema(params) }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    libraryInput: true,
    systemPrompt,
    task: "coverage-check",
  });

  const exam = params.goalKind === "exam";
  const outline = getNoticeOutline(params);

  const data: CoverageCheckResult = {
    examWeights: normalizeExamWeights({
      changes: result.output.examWeights ?? [],
      exam,
      graphSkills: params.skills,
    }),
    missing: normalizeCoverage({
      exam,
      graphSkills: params.skills,
      missing: result.output.missing.map((skill) => ({
        area: "",
        examWeight: null,
        topics: [],
        ...skill,
      })),
      outline,
      references: params.references,
    }),
    placements: normalizePlacements({
      graphSkills: params.skills,
      outline,
      placements: result.output.placements ?? [],
    }),
  };

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}

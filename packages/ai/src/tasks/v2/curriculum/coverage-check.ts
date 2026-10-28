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
 * Sonnet 5.5 found every planted gap on the coverage-check eval at 5.1s p50 (7 Oct 2026). Flash's
 * reasoning ran away on real goals while the learner waited; Opus matched Sonnet at twice the
 * price.
 */
const defaultModel = "anthropic/claude-sonnet-5.5";
const fallbackModels = ["google/gemini-3.8-flash", "openai/gpt-6-sol"] as const;

const examWeightsSchema = z.array(z.object({ examWeight: z.number(), key: z.string() }));

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
  examWeight?: number | null;
  area?: string | null;
  topics?: string[];
};

export type CoverageCheckParams = {
  language: string;
  goal: string;
  goalKind: "exam" | "language" | "learn";
  skills: CoverageSkill[];
  references: CoverageReference[];
  /**
   * Every skill is placed in its subjects and topics, and every topic no skill teaches gets one.
   */
  examOutline?: ExamOutline;
  model?: string;
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

type CoverageCheckResult = {
  examWeights: ExamWeightChange[];
  missing: MissingSkill[];
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

function getNoticeOutline(params: CoverageCheckParams): ExamOutline | undefined {
  return params.goalKind === "exam" ? params.examOutline : undefined;
}

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

import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import {
  type CoverageReference,
  type ExamWeightChange,
  type MissingSkill,
  normalizeCoverage,
  normalizeExamWeights,
} from "./_utils/normalize-coverage";
import systemPrompt from "./coverage-check.prompt.md";

/**
 * From the coverage-check eval (4 cases, code-scored, 26 Sep 2026): Gemini 3.8
 * Flash and Opus found every planted gap with no false alarms (10.0), Sol
 * 9.8 with one; Flash is the cheapest ($3.69 per 1,000 runs) and fastest.
 */
const defaultModel = "google/gemini-3.8-flash";
const fallbackModels = ["anthropic/claude-opus-5.5", "openai/gpt-6-sol"] as const;

const schema = z.object({
  examWeights: z.array(z.object({ examWeight: z.number(), key: z.string() })),
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

type CoverageSkill = {
  key: string;
  name: string;
  description: string;
  /** For an exam: how much of it depends on the skill, from 1 to 5. */
  examWeight?: number | null;
};

export type CoverageCheckParams = {
  language: string;
  goal: string;
  /** An exam's check also weighs its skills against the references. */
  goalKind: "exam" | "language" | "learn";
  skills: CoverageSkill[];
  /** Reference syllabi, official curricula or exam notices, as extracted text. */
  references: CoverageReference[];
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

type CoverageCheckResult = {
  /** For an exam: the skills already in the graph whose weight the references show is off. */
  examWeights: ExamWeightChange[];
  missing: MissingSkill[];
};

function formatSkill(skill: CoverageSkill): string {
  const line = `- ${skill.key}: ${skill.name}. ${skill.description}`;
  return typeof skill.examWeight === "number" ? `${line} (exam weight ${skill.examWeight})` : line;
}

function buildUserPrompt(params: CoverageCheckParams): string {
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
${params.skills.map((skill) => formatSkill(skill)).join("\n")}

${untrusted}
  `;
}

/**
 * Compares a skill graph with reference syllabi (university courses, official
 * curricula, exam notices) and returns the skills the references expect but
 * the graph misses, each with the syllabus line it comes from and where it
 * fits in the graph. For an exam, it also weighs them: each missing skill's
 * exam weight, and the graph's skills whose weight the notice's areas and
 * topic frequency show is off. Goals check their graph with it once research
 * found their references, and an exam's plan once research read its notice.
 */
export async function checkCoverage(params: CoverageCheckParams) {
  const { analytics, model = defaultModel, reasoning, useFallback = true } = params;
  const userPrompt = buildUserPrompt(params);
  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

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
    task: "coverage-check",
  });

  const exam = params.goalKind === "exam";

  const data: CoverageCheckResult = {
    examWeights: normalizeExamWeights({
      changes: result.output.examWeights,
      exam,
      graphSkills: params.skills,
    }),
    missing: normalizeCoverage({
      exam,
      graphSkills: params.skills,
      missing: result.output.missing,
      references: params.references,
    }),
  };

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}

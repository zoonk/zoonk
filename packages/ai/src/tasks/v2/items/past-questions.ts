import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import { GENERATED_ITEM_SCHEMAS } from "./item-schemas";
import systemPrompt from "./past-questions.prompt.md";

/**
 * The answer must copy long papers exactly: on the past-questions eval every quoted part matched
 * its paper and every key was right (27 Sep 2026).
 */
const defaultModel = "google/gemini-3.8-flash";
const fallbackModels = ["openai/gpt-6-sol"] as const;

const DEFAULT_COUNT = 10;
const MAX_COUNT = 20;
const DEFAULT_OPTION_COUNT = 5;

/** A whole exam day fits; anything longer is cut, and its questions wait for another call. */
const MAX_PAPER_LENGTH = 200_000;

export type PastQuestionFormat = "multipleChoice" | "trueFalse";

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: where the question is from comes before the copy. */
function questionSchema(format: PastQuestionFormat) {
  return z.object({
    number: z.string(),
    citation: z.string(),
    skill: z.number().int(),
    item: GENERATED_ITEM_SCHEMAS[format],
  });
}
/* oxlint-enable eslint/sort-keys */

type QuestionSchema = ReturnType<typeof questionSchema>;

export type PastQuestion = z.infer<QuestionSchema>;

export type ExtractPastQuestionsParams = {
  exam: string;
  format: PastQuestionFormat;
  language: string;
  optionCount?: number | null;
  count?: number;
  /** Numbered from 1 in this order. */
  skills: { name: string; description: string }[];
  paper: { title: string; text: string };
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function formatSkills(skills: ExtractPastQuestionsParams["skills"]): string {
  return skills
    .map((skill, index) => `${index + 1}. ${skill.name}: ${skill.description}`)
    .join("\n");
}

function buildUserPrompt(params: ExtractPastQuestionsParams): string {
  return `
    EXAM: ${params.exam}
    LANGUAGE: ${getPromptLanguageName({ language: params.language })}
    FORMAT: ${params.format}
    OPTION_COUNT: ${params.optionCount ?? DEFAULT_OPTION_COUNT}
    COUNT: ${Math.min(params.count ?? DEFAULT_COUNT, MAX_COUNT)}
    SKILLS:
${formatSkills(params.skills)}

${formatUntrustedInput({
  PAPER: `${params.paper.title}\n\n${params.paper.text.slice(0, MAX_PAPER_LENGTH)}`,
})}
  `;
}

/**
 * The caller decides whether a paper may be quoted at all, and code checks every quoted part
 * against the paper before anything is stored.
 */
export async function extractPastQuestions(params: ExtractPastQuestionsParams) {
  const { analytics, format, model = defaultModel, reasoning, useFallback = true } = params;
  const userPrompt = buildUserPrompt(params);
  const schema = z.object({ questions: z.array(questionSchema(format)) });
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
    libraryInput: true,
    systemPrompt,
    task: "past-questions",
  });

  const questions: PastQuestion[] = result.output.questions;

  return { data: { questions }, provenance, systemPrompt, usage: result.usage, userPrompt };
}

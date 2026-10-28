import "server-only";
import { Output, generateText } from "ai";
import { type z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { formatLocalContext } from "../../_utils/language-context";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import { type CourseLevel } from "../curriculum/_utils/course-levels";
import { WRITTEN_SCREEN_SCHEMAS } from "../lesson-writer/written-lesson-schema";
import noInstallPrompt from "./step-variant-no-install.prompt.md";
import toolPrompt from "./step-variant-tool.prompt.md";
import basePrompt from "./step-variant.prompt.md";

/**
 * Luna outscored Gemini 3.8 Flash on the step-variant eval at a tenth of the cost (26 Sep 2026).
 */
const defaultModel = "openai/gpt-6-luna";

/** Low reasoning keeps the scores up: 8.94 on the 4 tool screens (6 Oct 2026). */
const defaultReasoning: Reasoning = "low";
const fallbackModels = ["google/gemini-3.8-flash", "openai/gpt-6-sol"] as const;

/** For learners who install nothing: device steps become examples they read on the screen. */
export const NO_INSTALL_TOOL_KEY = "no-install";

const toolSystemPrompt = `${basePrompt}\n${toolPrompt}`;
const noInstallSystemPrompt = `${basePrompt}\n${noInstallPrompt}`;

export const VARIANT_SCREEN_KINDS = ["explanation", "workedExample", "check"] as const;
type VariantScreenKind = (typeof VARIANT_SCREEN_KINDS)[number];

type VariantScreenSchemas = Pick<typeof WRITTEN_SCREEN_SCHEMAS, VariantScreenKind>;
export type WrittenVariant = z.infer<VariantScreenSchemas[VariantScreenKind]>;

export type GenerateStepVariantParams = {
  /** The tool as the model reads it, or `NO_INSTALL_TOOL_KEY`. */
  key: string;
  screen: { kind: VariantScreenKind; content: unknown };
  lessonTitle: string;
  level: CourseLevel;
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function isNoInstall(params: GenerateStepVariantParams): boolean {
  return params.key === NO_INSTALL_TOOL_KEY;
}

function formatTool(params: GenerateStepVariantParams): string {
  return isNoInstall(params) ? "" : `\n${formatUntrustedInput({ KEY: params.key })}\n`;
}

function buildUserPrompt(params: GenerateStepVariantParams): string {
  return `
    SCREEN_KIND: ${params.screen.kind}
    LANGUAGE: ${getPromptLanguageName({ language: params.language })}
${formatLocalContext(params.language)}
    LEVEL: ${params.level}
    LESSON_TITLE: ${params.lessonTitle}
    SCREEN: ${JSON.stringify(params.screen.content)}
${formatTool(params)}  `;
}

/** In the lesson writer's shape, so core converts and validates it with the same code. */
export async function generateStepVariant(params: GenerateStepVariantParams) {
  const {
    analytics,
    model = defaultModel,
    reasoning = defaultReasoning,
    useFallback = true,
  } = params;

  const userPrompt = buildUserPrompt(params);
  const systemPrompt = isNoInstall(params) ? noInstallSystemPrompt : toolSystemPrompt;
  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });
  const schema: z.ZodType<WrittenVariant> = WRITTEN_SCREEN_SCHEMAS[params.screen.kind];

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
    task: "step-variant",
  });

  const data: WrittenVariant = result.output;

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}

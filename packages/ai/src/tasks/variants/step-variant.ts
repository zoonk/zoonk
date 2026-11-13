import "server-only";
import { Output, generateText } from "ai";
import { type z } from "zod";
import { formatUntrustedInput } from "../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../provider-options";
import { formatLocalContext } from "../_utils/language-context";
import { getPromptLanguageName } from "../_utils/prompt-language";
import { type CourseLevel } from "../curriculum/_utils/course-levels";
import { WRITTEN_SCREEN_SCHEMAS } from "../lesson-writer/written-lesson-schema";
import { NO_INSTALL_TOOL_KEY } from "./step-variant-key";
import noInstallPrompt from "./step-variant-no-install.prompt.md";
import toolPrompt from "./step-variant-tool.prompt.md";
import basePrompt from "./step-variant.prompt.md";

/**
 * At low reasoning on 8 cases (11 Nov 2026), Luna scored 8.91 (EN 9.04, PT 8.79) at 3.8 s p50 for
 * $0.25/1k, Muse Ember 8.99 at 2.2 s for $0.54/1k and Gemini 3.8 Flash 8.76 at 4.0 s for $1.62/1k.
 * A blind read split Ember and Flash 2 to 2 with 4 ties, so Ember falls back first at a third of
 * Flash's cost. Terra's 30 Oct outputs on 4 of those cases scored 9.38 at $2.04/1k, too small a
 * lead for eight times Luna's cost.
 */
const defaultModel = "openai/gpt-6-luna";
const defaultReasoning: Reasoning = "low";

const fallbackModels = [
  "meta/muse-ember",
  "google/gemini-3.8-flash",
  "openai/gpt-6.1-terra",
] as const;

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
  problems?: string[];
  /** The country the screen's lesson is set in; null is the language's own. */
  country: string | null;
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
${formatLocalContext({ country: params.country, language: params.language })}
    LEVEL: ${params.level}
    LESSON_TITLE: ${params.lessonTitle}
    SCREEN: ${JSON.stringify(params.screen.content)}
    PROBLEMS_TO_AVOID: ${JSON.stringify(params.problems ?? [])}
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

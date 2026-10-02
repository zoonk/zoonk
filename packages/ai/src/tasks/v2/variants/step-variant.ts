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
import systemPrompt from "./step-variant.prompt.md";

/**
 * Learners wait for "Simpler" and "Go deeper". In the step-variant eval (4
 * screens in English and Portuguese, 26 Sep 2026) Luna scored 8.76 at 3.3s p50
 * and $0.24 per 1,000, and Gemini 3.8 Flash 7.90 at 3.7s and $3.23. Tool and
 * no-install versions (4 more screens, 27 Sep 2026): Luna 8.3 to 9.6, with real
 * syntax and output, and no step left on the learner's device.
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.8-flash", "openai/gpt-6-sol"] as const;

const STEP_VARIANT_KINDS = ["simpler", "deeper", "field", "tool"] as const;
export type StepVariantKind = (typeof STEP_VARIANT_KINDS)[number];

/**
 * The `tool` key of the version for learners who go without installing anything: install and
 * run-on-your-device steps become examples and simulations they read on the screen.
 */
export const NO_INSTALL_TOOL_KEY = "no-install";

/** Screens that have other versions: explanations and worked examples, and checks for fields and tools. */
export const VARIANT_SCREEN_KINDS = ["explanation", "workedExample", "check"] as const;
type VariantScreenKind = (typeof VARIANT_SCREEN_KINDS)[number];

type VariantScreenSchemas = Pick<typeof WRITTEN_SCREEN_SCHEMAS, VariantScreenKind>;
export type WrittenVariant = z.infer<VariantScreenSchemas[VariantScreenKind]>;

export type GenerateStepVariantParams = {
  variant: StepVariantKind;
  /**
   * The field or tool as the model reads it ("nursing", "Spreadsheet (Google Sheets or Excel)",
   * or `NO_INSTALL_TOOL_KEY`); empty for "simpler" and "deeper".
   */
  key: string;
  /** The original screen: its stored kind and content. */
  screen: { kind: VariantScreenKind; content: unknown };
  lessonTitle: string;
  level: CourseLevel;
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function buildUserPrompt(params: GenerateStepVariantParams): string {
  return `
    VARIANT: ${params.variant}
    SCREEN_KIND: ${params.screen.kind}
    LANGUAGE: ${getPromptLanguageName({ language: params.language })}
${formatLocalContext(params.language)}
    LEVEL: ${params.level}
    LESSON_TITLE: ${params.lessonTitle}
    SCREEN: ${JSON.stringify(params.screen.content)}

${params.key ? formatUntrustedInput({ KEY: params.key }) : "KEY: none"}
  `;
}

/**
 * Writes a "Simpler", "Go deeper", field or tool version of one lesson screen
 * in the same shape the lesson writer uses, so core converts and validates it
 * with the same code. The result is shared by every learner who asks.
 */
export async function generateStepVariant(params: GenerateStepVariantParams) {
  const { analytics, model = defaultModel, reasoning, useFallback = true } = params;
  const userPrompt = buildUserPrompt(params);
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
    systemPrompt,
    task: "step-variant",
  });

  const data: WrittenVariant = result.output;

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}

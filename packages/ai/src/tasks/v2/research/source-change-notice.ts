import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import systemPrompt from "./source-change-notice.prompt.md";

const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.5-flash-lite"] as const;

/** The limit the prompt asks for, with room for a model that runs a little over. */
const MAX_NOTICE_LENGTH = 160;

const schema = z.object({ message: z.string() });

export type SourceChangeNoticeParams = {
  source: string;
  changes: string;
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

export async function generateSourceChangeNotice({
  analytics,
  changes,
  language,
  model = defaultModel,
  reasoning,
  source,
  useFallback = true,
}: SourceChangeNoticeParams) {
  const userPrompt = `LANGUAGE: ${getPromptLanguageName({ language })}

${formatUntrustedInput({ CHANGES: changes, SOURCE: source })}`;

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
    task: "source-change-notice",
  });

  return {
    data: { message: result.output.message.trim().slice(0, MAX_NOTICE_LENGTH) },
    provenance,
    systemPrompt,
    usage: result.usage,
    userPrompt,
  };
}

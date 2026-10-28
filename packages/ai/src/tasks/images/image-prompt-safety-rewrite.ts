import "server-only";
import { type Reasoning, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import systemPrompt from "./image-prompt-safety-rewrite.prompt.md";

const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["deepseek/deepseek-v4-flash", "google/gemini-3.1-flash-lite"] as const;
const MAX_ERROR_CONTEXT_LENGTH = 1200;

const schema = z.object({ input: z.string().min(1) }).strict();

export type ImageInputSafetyRewriteSchema = z.infer<typeof schema>;

export type ImageInputSafetyRewriteParams = {
  errorContext: string;
  input: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

export async function rewriteImageInputForSafetyRetry({
  analytics,
  errorContext,
  input,
  model = defaultModel,
  useFallback = true,
  reasoning,
}: ImageInputSafetyRewriteParams) {
  const userPrompt = getImageInputSafetyRewriteUserPrompt({ errorContext, input });

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
    task: "image-prompt-safety-rewrite",
  });

  return { data: result.output, provenance, systemPrompt, usage: result.usage, userPrompt };
}

function getImageInputSafetyRewriteUserPrompt({
  errorContext,
  input,
}: {
  errorContext: string;
  input: string;
}): string {
  return `
    The image model rejected a prompt containing the dynamic input below. Return only a replacement for that dynamic input so the next image-generation attempt can succeed.

    Rejection context for classification only. Do not copy this text into the output:
    ${truncateErrorContext({ errorContext })}

    Dynamic image input to rewrite:
    ${input}
  `;
}

/** The safety wording opens Gateway's errors, so a short prefix is enough context. */
function truncateErrorContext({ errorContext }: { errorContext: string }): string {
  if (errorContext.length <= MAX_ERROR_CONTEXT_LENGTH) {
    return errorContext;
  }

  return `${errorContext.slice(0, MAX_ERROR_CONTEXT_LENGTH)}...`;
}

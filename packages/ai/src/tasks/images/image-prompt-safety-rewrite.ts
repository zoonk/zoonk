import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import systemPrompt from "./image-prompt-safety-rewrite.prompt.md";

const defaultModel = "openai/gpt-5.6-luna";
const fallbackModels = ["deepseek/deepseek-v4-flash", "google/gemini-3.1-flash-lite"] as const;
const MAX_ERROR_CONTEXT_LENGTH = 1200;

const schema = z.object({ input: z.string().min(1) }).strict();

export type ImageInputSafetyRewriteSchema = z.infer<typeof schema>;

export type ImageInputSafetyRewriteParams = {
  errorContext: string;
  input: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

/**
 * Generates one safer replacement for the caller-owned image input after an
 * image model rejects the assembled prompt. Production retry code and evals
 * both use this task so the rewrite contract stays aligned as we tune
 * protected-character or sensitive-topic behavior.
 */
export async function rewriteImageInputForSafetyRetry({
  errorContext,
  input,
  model = defaultModel,
  useFallback = true,
  reasoningEffort,
}: ImageInputSafetyRewriteParams) {
  const userPrompt = getImageInputSafetyRewriteUserPrompt({ errorContext, input });

  const providerOptions = buildProviderOptions({
    fallbackModels,
    model,
    reasoningEffort,
    useFallback,
  });

  const { output, usage } = await generateText({
    instructions: systemPrompt,
    model,
    output: Output.object({ schema }),
    prompt: userPrompt,
    providerOptions,
  });

  return { data: output, systemPrompt, usage, userPrompt };
}

/**
 * Gives the rewrite model enough rejection context to identify the blocked
 * class of content, while keeping the rewrite target limited to the dynamic
 * input that production callers will place back into their stable prompt.
 */
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

/**
 * Prevents very large provider payloads from crowding out the original prompt
 * in the rewrite request. The safety wording appears at the start of current
 * Gateway errors, so a short prefix is enough for classification context.
 */
function truncateErrorContext({ errorContext }: { errorContext: string }): string {
  if (errorContext.length <= MAX_ERROR_CONTEXT_LENGTH) {
    return errorContext;
  }

  return `${errorContext.slice(0, MAX_ERROR_CONTEXT_LENGTH)}...`;
}

import { stringifyUnknown } from "@zoonk/utils/json";
import { type GenerateImageResult, generateImage } from "ai";
import { rewriteImageInputForSafetyRetry } from "../images/image-prompt-safety-rewrite";

type GenerateImageParams = Parameters<typeof generateImage>[0];
type ImagePromptBuilder = ({ input }: { input: string }) => string;

type GenerateImageWithSafetyRetryParams = Omit<GenerateImageParams, "prompt"> & {
  buildPrompt: ImagePromptBuilder;
  input: string;
};

const MAX_ERROR_INSPECTION_DEPTH = 4;

const safetyRejectionSignals = [
  "rejected by the safety system",
  "blocked by the safety system",
  "violates our content policy",
  "content policy",
  "safety policy",
  "disallowed content",
  "copyright",
  "trademark",
] as const;

/**
 * Uses a text model to rewrite only the caller-owned content input that caused
 * rejection. The stable image prompt template stays in the original task so
 * format, style, language, and composition constraints do not drift on retry.
 */
async function rewriteSafetyRejectedImageInput({
  error,
  input,
}: {
  error: unknown;
  input: string;
}): Promise<string> {
  const { data } = await rewriteImageInputForSafetyRetry({
    errorContext: getErrorInspectionText({ error }),
    input,
  });

  return data.input.trim();
}

/**
 * Rebuilds the complete model prompt from the dynamic input at the last moment.
 * The first attempt and retry both pass through the same task-owned prompt
 * builder, so only the unsafe content changes between attempts.
 */
function buildGenerateImageParams({
  buildPrompt,
  input,
  ...params
}: GenerateImageWithSafetyRetryParams): GenerateImageParams {
  return { ...params, prompt: buildPrompt({ input }) };
}

/**
 * Retries image generation once when the provider rejects the prompt for safety
 * or protected-content reasons. Normal transient failures are left to the AI
 * SDK retry layer, and normal non-safety failures still surface immediately.
 */
export async function generateImageWithSafetyRetry(
  params: GenerateImageWithSafetyRetryParams,
): Promise<GenerateImageResult> {
  try {
    return await generateImage(buildGenerateImageParams(params));
  } catch (error) {
    if (!isImageSafetyRejection({ error })) {
      throw error;
    }

    const input = await rewriteSafetyRejectedImageInput({ error, input: params.input });

    return generateImage(buildGenerateImageParams({ ...params, input }));
  }
}

/**
 * Detects the provider responses that are worth rewriting. The important
 * signal is the provider's safety/protected-content wording, not the HTTP code,
 * because Gateway can wrap the same rejection in different error classes.
 */
function isImageSafetyRejection({ error }: { error: unknown }): boolean {
  const text = getErrorInspectionText({ error }).toLowerCase();

  return safetyRejectionSignals.some((signal) => text.includes(signal));
}

/**
 * Collects searchable text from the thrown error and nested causes. Error
 * messages are added explicitly because `JSON.stringify(new Error(...))` skips
 * non-enumerable fields like `message`, while SDK wrapper objects often carry
 * the provider response in enumerable fields such as `responseBody` or `data`.
 */
function getErrorInspectionText({ error, depth = 0 }: { error: unknown; depth?: number }): string {
  if (depth > MAX_ERROR_INSPECTION_DEPTH || error === null || error === undefined) {
    return "";
  }

  const errorText = error instanceof Error ? `${error.name}\n${error.message}` : "";
  const objectText = stringifyUnknown(error);
  const cause = error instanceof Error ? error.cause : null;
  const causeText = getErrorInspectionText({ depth: depth + 1, error: cause });

  return [errorText, objectText, causeText].filter(Boolean).join("\n");
}

import { stringifyUnknown } from "@zoonk/utils/json";
import { type GenerateImageResult, generateImage } from "ai";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
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

async function rewriteSafetyRejectedImageInput({
  analytics,
  error,
  input,
}: {
  analytics?: AiGenerationContext;
  error: unknown;
  input: string;
}): Promise<string> {
  const { data } = await rewriteImageInputForSafetyRetry({
    analytics,
    errorContext: getErrorInspectionText({ error }),
    input,
  });

  return data.input.trim();
}

function buildGenerateImageParams({
  buildPrompt,
  input,
  ...params
}: GenerateImageWithSafetyRetryParams): GenerateImageParams {
  return { ...params, prompt: buildPrompt({ input }) };
}

/** Retries once, only after a safety rejection; the AI SDK retries transient failures. */
export async function generateImageWithSafetyRetry({
  analytics,
  ...params
}: GenerateImageWithSafetyRetryParams & {
  analytics?: AiGenerationContext;
}): Promise<GenerateImageResult> {
  try {
    return await generateImage(buildGenerateImageParams(params));
  } catch (error) {
    if (!isImageSafetyRejection({ error })) {
      throw error;
    }

    const input = await rewriteSafetyRejectedImageInput({ analytics, error, input: params.input });

    return generateImage(buildGenerateImageParams({ ...params, input }));
  }
}

/** Reads the wording, not the HTTP code: Gateway wraps the same rejection in different errors. */
function isImageSafetyRejection({ error }: { error: unknown }): boolean {
  const text = getErrorInspectionText({ error }).toLowerCase();

  return safetyRejectionSignals.some((signal) => text.includes(signal));
}

/** `JSON.stringify` skips an Error's non-enumerable `message`, so messages are added explicitly. */
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

import "server-only";
import { Output, generateText } from "ai";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import { type ImageScene, imageSceneSchema, normalizeImageScene } from "./image-scene-schema";
import systemPrompt from "./image-scene.prompt.md";

/**
 * Gemini 3.8 Flash scored highest on the image-scene eval (26 Sep 2026). The scene decides whether
 * the picture teaches, and costs little next to the image itself.
 */
const defaultModel = "google/gemini-3.8-flash";
const fallbackModels = ["openai/gpt-6-luna", "google/gemini-3.5-flash-lite"] as const;

export type ImageSceneInput = {
  language: string;
  /** False for language courses. */
  textAllowed: boolean;
  request: string;
  screenText?: string | null;
  context?: string | null;
};

export type ImageSceneParams = ImageSceneInput & {
  analytics?: AiGenerationContext;
  model?: string;
  reasoning?: Reasoning;
  useFallback?: boolean;
};

function buildUserPrompt(input: ImageSceneInput): string {
  return `
    LANGUAGE: ${getPromptLanguageName({ language: input.language })}
    TEXT_ALLOWED: ${input.textAllowed ? "yes" : "no"}
    REQUEST: ${input.request}
    SCREEN_TEXT: ${input.screenText || "none"}
    CONTEXT: ${input.context || "none"}
  `;
}

/** Code enforces the scene's limits, so the style never depends on the model obeying. */
export async function generateImageScene({
  analytics,
  model = defaultModel,
  reasoning,
  useFallback = true,
  ...input
}: ImageSceneParams) {
  const userPrompt = buildUserPrompt(input);
  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema: imageSceneSchema }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    libraryInput: true,
    systemPrompt,
    task: "image-scene",
  });

  const data: ImageScene = normalizeImageScene({
    scene: result.output,
    textAllowed: input.textAllowed,
  });

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}

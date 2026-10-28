import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import systemPrompt from "./image-check.prompt.md";
import { type ImageScene, describeImageScene } from "./image-scene-schema";

/**
 * Claude Haiku 5.5 matched Luna on the image-check eval at 1.9s p50 against 3.1s (7 Oct 2026);
 * listing problems first, it passed all 15 good images and caught 12 of 13 bad ones (8 Oct 2026).
 */
const defaultModel = "anthropic/claude-haiku-5.5";
const defaultReasoning: Reasoning = "none";
const fallbackModels = ["openai/gpt-6-luna", "google/gemini-3.8-flash"] as const;

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: with thinking off, the model names what fails before it rules on it. */
const schema = z.object({
  problems: z.array(z.string()),
  matchesScene: z.boolean(),
  onStyle: z.boolean(),
  textCorrect: z.boolean(),
});
/* oxlint-enable eslint/sort-keys */

export type ImageCheckVerdict = z.infer<typeof schema> & { passed: boolean };

type ImageCheckInput = {
  image: { data: Uint8Array; mediaType: string };
  scene: ImageScene;
  language: string;
};

export type ImageCheckParams = ImageCheckInput & {
  analytics?: AiGenerationContext;
  model?: string;
  reasoning?: Reasoning;
  /** Haiku answers at the standard tier through the gateway either way. */
  serviceTier?: ServiceTier;
  useFallback?: boolean;
};

function formatLabels({ language, scene }: Pick<ImageCheckInput, "language" | "scene">): string {
  if (scene.labels.length === 0) {
    return "none";
  }

  const labels = scene.labels.map((label) => `"${label.text}"`).join(", ");
  return `${labels} (in ${getPromptLanguageName({ language })})`;
}

/**
 * Pictures are shown as soon as they're drawn and checked after: a failed one is drawn again and
 * replaced, and a screen whose redraws fail too goes without one.
 */
export async function checkLessonImage({
  analytics,
  image,
  language,
  model = defaultModel,
  reasoning = defaultReasoning,
  scene,
  serviceTier,
  useFallback = true,
}: ImageCheckParams) {
  const userPrompt = `SCENE: ${describeImageScene(scene)}\nLABELS: ${formatLabels({ language, scene })}`;
  const providerOptions = buildProviderOptions({ fallbackModels, model, serviceTier, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        messages: [
          {
            content: [
              { text: userPrompt, type: "text" },
              { data: image.data, mediaType: image.mediaType, type: "file" },
            ],
            role: "user",
          },
        ],
        model,
        output: Output.object({ schema }),
        providerOptions,
        reasoning,
      }),
    libraryInput: true,
    systemPrompt,
    task: "image-check",
  });

  const { matchesScene, onStyle, textCorrect } = result.output;

  const data: ImageCheckVerdict = {
    ...result.output,
    passed: matchesScene && onStyle && textCorrect,
  };

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}

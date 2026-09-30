import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import systemPrompt from "./image-check.prompt.md";
import { type ImageScene, describeImageScene } from "./image-scene-schema";

/**
 * From the image-check eval (23 hand-labeled images, 27 Sep 2026, after
 * adding real cases where the drawing model named objects nobody asked for):
 * Luna and Gemini 3.8 Flash caught every failure and passed every good image;
 * Flash Lite let one image with unrequested labels through. Luna is the
 * cheapest of the three at $0.40 per 1,000 checks, with a 2.3s median.
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.8-flash", "google/gemini-3.5-flash-lite"] as const;

const schema = z.object({
  matchesScene: z.boolean(),
  onStyle: z.boolean(),
  problems: z.array(z.string()),
  textCorrect: z.boolean(),
});

export type ImageCheckVerdict = z.infer<typeof schema> & { passed: boolean };

type ImageCheckInput = {
  image: { data: Uint8Array; mediaType: string };
  scene: ImageScene;
  /** The labels' language. */
  language: string;
};

export type ImageCheckParams = ImageCheckInput & {
  analytics?: AiGenerationContext;
  model?: string;
  reasoning?: Reasoning;
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
 * The check before an image is used: does it show the scene, is it on style,
 * and is any text short, legible and spelled right in the lesson's language?
 * An image passes only when all three hold; the caller makes a failed image
 * once more and then ships the screen without one.
 */
export async function checkLessonImage({
  analytics,
  image,
  language,
  model = defaultModel,
  reasoning,
  scene,
  useFallback = true,
}: ImageCheckParams) {
  const userPrompt = `SCENE: ${describeImageScene(scene)}\nLABELS: ${formatLabels({ language, scene })}`;
  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

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

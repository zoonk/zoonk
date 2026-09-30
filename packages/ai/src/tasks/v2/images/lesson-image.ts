import "server-only";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runImageTaskGeneration } from "../../../provenance/run-image-generation";
import { type ImageGenerationQuality, buildImageProviderOptions } from "../../../provider-options";
import { generateImageWithSafetyRetry } from "../../_utils/generate-image-with-safety-retry";
import { type ImageScene } from "./image-scene-schema";
import { IMAGE_SIZE, IMAGE_STYLE_VERSION, type ImagePalette } from "./image-style";
import {
  LESSON_IMAGE_TEMPLATE,
  buildLessonImagePrompt,
  formatImageSceneInput,
} from "./lesson-image-prompt";

/**
 * Low quality is enough for flat scenes with lots of empty space, and medium
 * costs several times more per image. In the lesson-image eval (8 scenes,
 * Opus 5.5 vision judge, 26 Sep 2026) it scored 8.56 against gpt-image-2's
 * 8.04, at about $0.008 per image.
 */
const defaultModel = "openai/gpt-image-2.5-flare";
const DEFAULT_QUALITY: ImageGenerationQuality = "low";

const fallbackModels = [
  "bfl/flux-kontext-max",
  "bytedance/seedream-5.0-lite",
  "recraft/recraft-v4.1-utility",
] as const;

export type LessonImageParams = {
  scene: ImageScene;
  /** What the check rejected in the previous drawing of this scene, for a second attempt. */
  corrections?: readonly string[];
  /** The labels' language. */
  language: string;
  palette: ImagePalette;
  analytics?: AiGenerationContext;
  model?: string;
  quality?: ImageGenerationQuality;
  /** Evals turn fallbacks off so each image comes from the model under test. */
  useFallback?: boolean;
};

/**
 * Draws one image from a structured scene with the fixed style block. The
 * prompt version names the style version, so stored images can be grouped by
 * the rules that drew them. Checking, storing and reuse happen in core.
 */
export async function generateLessonImage({
  analytics,
  corrections,
  language,
  model = defaultModel,
  palette,
  quality = DEFAULT_QUALITY,
  scene,
  useFallback = true,
}: LessonImageParams) {
  const sceneInput = formatImageSceneInput({ corrections, language, scene });

  const { provenance, result } = await runImageTaskGeneration({
    analytics,
    generate: () =>
      generateImageWithSafetyRetry({
        analytics,
        buildPrompt: ({ input }) => buildLessonImagePrompt({ palette, sceneInput: input }),
        input: sceneInput,
        maxImagesPerCall: 1,
        model,
        providerOptions: buildImageProviderOptions({
          fallbackModels: useFallback ? fallbackModels : [],
          quality,
        }),
        size: IMAGE_SIZE,
      }),
    promptVersion: `style-v${IMAGE_STYLE_VERSION}`,
    requestedModel: model,
    systemPrompt: LESSON_IMAGE_TEMPLATE,
    task: "lesson-image",
  });

  const prompt = buildLessonImagePrompt({ palette, sceneInput });

  return { data: { image: result.image }, prompt, provenance };
}

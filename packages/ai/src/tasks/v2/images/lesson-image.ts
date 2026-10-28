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
 * Low quality is enough for flat scenes, and medium costs several times more. It scored 8.56 on
 * the lesson-image eval against gpt-image-2's 8.04 (26 Sep 2026).
 */
const defaultModel = "openai/gpt-image-2.5-flare";
const DEFAULT_QUALITY: ImageGenerationQuality = "low";

export type LessonImageParams = {
  scene: ImageScene;
  corrections?: readonly string[];
  language: string;
  palette: ImagePalette;
  analytics?: AiGenerationContext;
  model?: string;
  quality?: ImageGenerationQuality;
  /** Evals turn fallbacks off so each image comes from the model under test. */
  useFallback?: boolean;
};

/**
 * The prompt version names the style version, so images can be grouped by the rules that drew them.
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
    generate: ({ promptTraining }) =>
      generateImageWithSafetyRetry({
        analytics,
        buildPrompt: ({ input }) => buildLessonImagePrompt({ palette, sceneInput: input }),
        input: sceneInput,
        maxImagesPerCall: 1,
        model,
        providerOptions: buildImageProviderOptions({
          promptTraining,
          quality,
          size: IMAGE_SIZE,
          useFallback,
        }),
        size: IMAGE_SIZE,
      }),
    libraryInput: true,
    promptVersion: `style-v${IMAGE_STYLE_VERSION}`,
    requestedModel: model,
    systemPrompt: LESSON_IMAGE_TEMPLATE,
    task: "lesson-image",
  });

  const prompt = buildLessonImagePrompt({ palette, sceneInput });

  return { data: { image: result.image }, prompt, provenance };
}

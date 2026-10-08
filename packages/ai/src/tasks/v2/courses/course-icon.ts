import "server-only";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runImageTaskGeneration } from "../../../provenance/run-image-generation";
import { type ImageGenerationQuality, buildImageProviderOptions } from "../../../provider-options";
import { generateImageWithSafetyRetry } from "../../_utils/generate-image-with-safety-retry";
import promptTemplate from "./course-icon.prompt.md";

/**
 * Course icons keep the style courses had before the Library: one matte 3D
 * object on white, like an app icon, drawn by the lesson images' model at low
 * quality. In the course-icon eval (3 courses, Opus 5.5 vision judge, 27 Sep
 * 2026) it scored 8.27 at about $0.007 an icon; the judge's only complaint
 * was the prompt's old habit of pairing a second small object with the main one.
 */
const defaultModel = "openai/gpt-image-2.5-flare";
const DEFAULT_QUALITY: ImageGenerationQuality = "low";
const ICON_SIZE = "1024x1024";

/**
 * Every image call keeps to providers that don't train on prompts (`noPromptTrainingImageMiddleware`),
 * which rules out FLUX and Recraft (BFL's terms also forbid data about anyone under 18), and
 * Seedream refuses images under 3.7 megapixels. Sunburst letters as well as Flare at the same
 * price (mind-map eval, 7 Oct 2026).
 */
const fallbackModels = ["openai/gpt-image-2.5-sunburst"] as const;

function buildCourseIconPrompt({ input }: { input: string }): string {
  return promptTemplate.replace("{{INPUT}}", () => input);
}

/**
 * The course is the only caller-owned part of the prompt, so a safety retry
 * rewrites just this and the art direction stays the same.
 */
function formatCourseIconInput({
  description,
  title,
}: {
  description: string | null | undefined;
  title: string;
}): string {
  return [`TOPIC: ${title}`, description ? `CONTEXT: ${description}` : ""]
    .filter(Boolean)
    .join("\n");
}

export type CourseIconParams = {
  title: string;
  /** The course's description, so a broad title like "Energy" gets the right object. */
  description?: string | null;
  analytics?: AiGenerationContext;
  model?: string;
  quality?: ImageGenerationQuality;
  /** Evals turn fallbacks off so each icon comes from the model under test. */
  useFallback?: boolean;
};

/**
 * Draws a course's icon: a single object that stands for the subject. Storing
 * and linking it happen in core.
 */
export async function generateCourseIcon({
  analytics,
  description,
  model = defaultModel,
  quality = DEFAULT_QUALITY,
  title,
  useFallback = true,
}: CourseIconParams) {
  const input = formatCourseIconInput({ description, title });

  const { provenance, result } = await runImageTaskGeneration({
    analytics,
    generate: () =>
      generateImageWithSafetyRetry({
        analytics,
        buildPrompt: buildCourseIconPrompt,
        input,
        maxImagesPerCall: 1,
        model,
        providerOptions: buildImageProviderOptions({
          fallbackModels: useFallback ? fallbackModels : [],
          quality,
        }),
        size: ICON_SIZE,
      }),
    requestedModel: model,
    systemPrompt: promptTemplate,
    task: "course-icon",
  });

  return { data: { image: result.image }, prompt: buildCourseIconPrompt({ input }), provenance };
}

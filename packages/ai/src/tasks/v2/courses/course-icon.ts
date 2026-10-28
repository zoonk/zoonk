import "server-only";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runImageTaskGeneration } from "../../../provenance/run-image-generation";
import { type ImageGenerationQuality, buildImageProviderOptions } from "../../../provider-options";
import { generateImageWithSafetyRetry } from "../../_utils/generate-image-with-safety-retry";
import promptTemplate from "./course-icon.prompt.md";

/** It scored 8.27 on the course-icon eval at about $0.007 an icon (27 Sep 2026). */
const defaultModel = "openai/gpt-image-2.5-flare";
const DEFAULT_QUALITY: ImageGenerationQuality = "low";
const ICON_SIZE = "1024x1024";

function buildCourseIconPrompt({ input }: { input: string }): string {
  return promptTemplate.replace("{{INPUT}}", () => input);
}

/** The only caller-owned part of the prompt, so a safety retry rewrites just this. */
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
    generate: ({ promptTraining }) =>
      generateImageWithSafetyRetry({
        analytics,
        buildPrompt: buildCourseIconPrompt,
        input,
        maxImagesPerCall: 1,
        model,
        providerOptions: buildImageProviderOptions({
          promptTraining,
          quality,
          size: ICON_SIZE,
          useFallback,
        }),
        size: ICON_SIZE,
      }),
    libraryInput: true,
    requestedModel: model,
    systemPrompt: promptTemplate,
    task: "course-icon",
  });

  return { data: { image: result.image }, prompt: buildCourseIconPrompt({ input }), provenance };
}

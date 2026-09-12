import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type Reasoning, buildProviderOptions } from "../../provider-options";
import { getPromptLanguageName } from "../_utils/prompt-language";
import systemPrompt from "./step-image-prompts.prompt.md";

const defaultModel = "openai/gpt-5.6-sol";

const fallbackModels = [
  "openai/gpt-5.6-sol",
  "anthropic/claude-opus-4.8",
  "google/gemini-3.1-pro-preview",
] as const;

const imagePromptSchema = z.object({
  alt: z
    .string()
    .min(1)
    .describe(
      "A concise description of the visible teaching content in LANGUAGE, without instructions for generating or styling the image.",
    ),
  prompt: z.string().min(1),
  stepIndex: z.number().int().min(0),
});

/** Explicit indices keep a selected illustration attached to the intended screen. */
function buildSchema(stepCount: number) {
  return z.object({
    images: z
      .array(
        imagePromptSchema.extend({
          stepIndex: z
            .number()
            .int()
            .min(0)
            .max(stepCount - 1),
        }),
      )
      .max(1),
    visualLearningGoal: z
      .string()
      .describe(
        "The lesson skill from LESSON_TITLE and LESSON_DESCRIPTION, never the example topic. Explain the visible information needed to learn that skill, or say none.",
      ),
    visualNeed: z
      .enum(["none", "appearance", "spatial", "motion", "mechanism"])
      .describe(
        "Does the actual lesson skill require seeing appearance, spatial layout, physical movement or a mechanism? Communication, wording, reasoning and abstract contrasts are none even if the example mentions a visible object. Decide before writing an image prompt.",
      ),
  });
}

type StepImagePromptsParams = {
  lessonTitle: string;
  lessonDescription: string;
  chapterTitle: string;
  courseTitle: string;
  language: string;
  steps: { title: string; text: string }[];
  imageMode?: "key" | "instructional";
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
};

/** Chooses one useful illustration, or none when text communicates the concept. */
export async function generateStepImagePrompts({
  lessonTitle,
  lessonDescription,
  chapterTitle,
  courseTitle,
  language,
  steps,
  imageMode = "key",
  model = defaultModel,
  useFallback = true,
  reasoning,
}: StepImagePromptsParams) {
  const formattedSteps = steps
    .map((step, index) => `${index}. ${step.title}: ${step.text}`)
    .join("\n");

  const promptLanguage = getPromptLanguageName({ language });

  const userPrompt = `
    LESSON_TITLE: ${lessonTitle}
    LESSON_DESCRIPTION: ${lessonDescription}
    CHAPTER_TITLE: ${chapterTitle}
    COURSE_TITLE: ${courseTitle}
    LANGUAGE: ${promptLanguage}
    STEPS: ${formattedSteps}
    IMAGE_MODE: ${imageMode}
  `;

  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

  const { output, usage } = await generateText({
    instructions: systemPrompt,
    model,
    output: Output.object({ schema: buildSchema(steps.length) }),
    prompt: userPrompt,
    providerOptions,
    reasoning,
  });

  const images = imageMode === "instructional" && output.visualNeed === "none" ? [] : output.images;
  return { data: { images }, systemPrompt, usage, userPrompt };
}

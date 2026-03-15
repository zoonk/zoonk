import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import systemPrompt from "./lesson-activities.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_LESSON_ACTIVITIES ?? "google/gemini-3-flash";
const FALLBACK_MODELS = ["anthropic/claude-opus-4.6", "openai/gpt-5.4"];

const schema = z.object({
  activities: z.array(
    z.object({
      description: z.string(),
      title: z.string(),
    }),
  ),
});

export type LessonActivitiesSchema = z.infer<typeof schema>;
export type GeneratedActivity = LessonActivitiesSchema["activities"][number];

export type LessonActivitiesParams = {
  lessonTitle: string;
  lessonDescription: string;
  chapterTitle: string;
  courseTitle: string;
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

export async function generateLessonActivities({
  lessonTitle,
  lessonDescription,
  chapterTitle,
  courseTitle,
  language,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: LessonActivitiesParams) {
  const userPrompt = `LESSON_TITLE: ${lessonTitle}
LESSON_DESCRIPTION: ${lessonDescription}
CHAPTER_TITLE: ${chapterTitle}
COURSE_TITLE: ${courseTitle}
LANGUAGE: ${language}`;

  const providerOptions = buildProviderOptions({
    fallbackModels: FALLBACK_MODELS,
    reasoningEffort,
    useFallback,
  });

  const { output, usage } = await generateText({
    model,
    output: Output.object({ schema }),
    prompt: userPrompt,
    providerOptions,
    system: systemPrompt,
  });

  return { data: output, systemPrompt, usage, userPrompt };
}

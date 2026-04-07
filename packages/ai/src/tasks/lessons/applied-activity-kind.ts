import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import systemPrompt from "./applied-activity-kind.prompt.md";

const DEFAULT_MODEL =
  process.env.AI_MODEL_APPLIED_ACTIVITY_KIND ?? "google/gemini-3.1-flash-lite-preview";
const FALLBACK_MODELS = ["openai/gpt-5.4-nano", "anthropic/claude-haiku-4.5"];

const schema = z.object({
  appliedActivityKind: z.enum(["investigation", "story"]),
});

export type AppliedActivityKindSchema = z.infer<typeof schema>;

export type AppliedActivityKindParams = {
  lessonTitle: string;
  lessonDescription: string;
  chapterTitle: string;
  courseTitle: string;
  concepts: string[];
  language: string;
  recentAppliedKinds: string[];
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

/**
 * Classifies whether a core lesson should include an applied activity
 * (`story`, `investigation`, etc).
 */
export async function generateAppliedActivityKind({
  lessonTitle,
  lessonDescription,
  chapterTitle,
  courseTitle,
  concepts,
  language,
  recentAppliedKinds,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: AppliedActivityKindParams) {
  const userPrompt = `
    LESSON_TITLE: ${lessonTitle}
    LESSON_DESCRIPTION: ${lessonDescription}
    CHAPTER_TITLE: ${chapterTitle}
    COURSE_TITLE: ${courseTitle}
    CONCEPTS: ${concepts.join(", ")}
    LANGUAGE: ${language}
    RECENT_APPLIED_KINDS: ${recentAppliedKinds.join(", ")}
  `;

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

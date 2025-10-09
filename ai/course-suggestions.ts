import "server-only";
import type { LanguageModelUsage } from "ai";
import { generateObject } from "ai";
import { z } from "zod";
import { repairAIText } from "@/lib/utils";
import systemPrompt from "./course-suggestions.md";

const model = process.env.AI_MODEL_COURSE_SUGGESTIONS || "openai/gpt-4.1";

const schema = z.object({
  courses: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
    }),
  ),
});

export interface CourseSuggestion {
  title: string;
  description: string;
}

export interface CourseSuggestionsResult {
  courses: CourseSuggestion[];
  usage: LanguageModelUsage;
}

export async function generateCourseSuggestions({
  locale,
  prompt,
  modelOverride,
}: {
  locale: string;
  prompt: string;
  modelOverride?: string;
}): Promise<CourseSuggestionsResult> {
  const userPrompt = `
    APP_LANGUAGE: ${locale}
    USER_INPUT: ${prompt}
  `;

  const { object, usage } = await generateObject({
    model: modelOverride || model,
    schema,
    prompt: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    experimental_repairText: async ({ text, error }) =>
      repairAIText({
        text,
        error,
        context: `[courseSuggestion] [${locale}] "${prompt}"`,
      }),
  });

  return { courses: object.courses, usage };
}

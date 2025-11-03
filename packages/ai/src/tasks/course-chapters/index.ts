import "server-only";

import { generateObject } from "ai";
import { z } from "zod";
import basePrompt from "./prompt.md";
import advancedPrompt from "./prompt-advanced.md";
import basicPrompt from "./prompt-basic.md";
import intermediatePrompt from "./prompt-intermediate.md";

export type CourseChaptersParams = {
  locale: string;
  model: string;
  courseTitle: string;
  level: "basic" | "intermediate" | "advanced";
  previousChapters: string[];
};

function getPrompt(level: CourseChaptersParams["level"]) {
  switch (level) {
    case "basic":
      return basicPrompt;
    case "intermediate":
      return `${basePrompt}\n\n${intermediatePrompt}`;
    case "advanced":
      return `${basePrompt}\n\n${advancedPrompt}`;
  }
}

const schema = z.object({
  chapters: z.array(
    z.object({
      description: z.string(),
      title: z.string(),
    }),
  ),
});

export type CourseChaptersSchema = z.infer<typeof schema>;

export async function generateCourseChapters({
  locale,
  courseTitle,
  model,
  level,
  previousChapters,
}: CourseChaptersParams) {
  const systemPrompt = getPrompt(level);

  const userPrompt = `
    LANGUAGE: ${locale}
    COURSE_TITLE: ${courseTitle}
    PREVIOUS_CHAPTERS: ${previousChapters.join(", ")}
  `;

  const { object, usage } = await generateObject({
    model,
    prompt: userPrompt,
    schema,
    system: systemPrompt,
  });

  return { data: object, systemPrompt, usage, userPrompt };
}

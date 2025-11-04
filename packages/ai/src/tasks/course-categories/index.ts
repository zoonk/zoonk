import "server-only";

import { generateObject } from "ai";
import { z } from "zod";
import systemPrompt from "./prompt.md";

const ALLOWED_CATEGORIES = [
  "arts",
  "business",
  "communication",
  "culture",
  "economics",
  "engineering",
  "geography",
  "health",
  "history",
  "languages",
  "law",
  "math",
  "science",
  "society",
  "tech",
] as const;

const schema = z.object({
  categories: z.array(z.enum(ALLOWED_CATEGORIES)),
});

export type CourseCategoriesSchema = z.infer<typeof schema>;

export type CourseCategoriesParams = {
  courseTitle: string;
  model: string;
};

export async function generateCourseCategories({
  courseTitle,
  model,
}: CourseCategoriesParams) {
  const userPrompt = `COURSE_TITLE: ${courseTitle}`;

  const { object, usage } = await generateObject({
    model,
    prompt: userPrompt,
    schema,
    system: systemPrompt,
  });

  return { data: object, systemPrompt, usage, userPrompt };
}

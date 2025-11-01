import "server-only";

import { generateObject } from "ai";
import { z } from "zod";
import advancedPrompt from "./prompt-advanced.md";
import basicPrompt from "./prompt-basic.md";
import intermediatePrompt from "./prompt-intermediate.md";
import sharedPrompt from "./prompt-shared.md";

type CourseChaptersParams = {
  locale: string;
  model: string;
  courseTitle: string;
};

const basicSchema = z.object({
  chapters: z.array(z.string()),
  courseDescription: z.string(),
});

const intermediateSchema = z.object({
  chapters: z.array(z.string()),
});

const advancedSchema = intermediateSchema;

export type CourseChaptersBasicSchema = z.infer<typeof basicSchema>;

export type CourseChaptersIntermediateSchema = z.infer<
  typeof intermediateSchema
>;

export type CourseChaptersAdvancedSchema = z.infer<typeof advancedSchema>;

export type CourseChapterBasicParams = CourseChaptersParams;

export type CourseChapterIntermediateParams = CourseChaptersParams & {
  previousChapters: string[];
};

export type CourseChapterAdvancedParams = CourseChapterIntermediateParams;

export async function generateBasicCourseChapters({
  locale,
  courseTitle,
  model,
}: CourseChapterBasicParams) {
  const systemPrompt = `${sharedPrompt}\n\n${basicPrompt}`;

  const userPrompt = `
    APP_LANGUAGE: ${locale}
    COURSE_TITLE: ${courseTitle}
  `;

  const { object, usage } = await generateObject({
    model,
    prompt: userPrompt,
    schema: basicSchema,
    system: systemPrompt,
  });

  return { data: object, systemPrompt, usage, userPrompt };
}

export async function generateIntermediateCourseChapters({
  locale,
  courseTitle,
  previousChapters,
  model,
}: CourseChapterIntermediateParams) {
  const systemPrompt = `${sharedPrompt}\n\n${intermediatePrompt}`;

  const userPrompt = `
    APP_LANGUAGE: ${locale}
    COURSE_TITLE: ${courseTitle}
    PREVIOUS_CHAPTERS: ${previousChapters.join(", ")}
  `;

  const { object, usage } = await generateObject({
    model,
    prompt: userPrompt,
    schema: intermediateSchema,
    system: systemPrompt,
  });

  return { data: object, systemPrompt, usage, userPrompt };
}

export async function generateAdvancedCourseChapters({
  locale,
  courseTitle,
  previousChapters,
  model,
}: CourseChapterAdvancedParams) {
  const systemPrompt = `${sharedPrompt}\n\n${advancedPrompt}`;

  const userPrompt = `
    APP_LANGUAGE: ${locale}
    COURSE_TITLE: ${courseTitle}
    PREVIOUS_CHAPTERS: ${previousChapters.join(", ")}
  `;

  const { object, usage } = await generateObject({
    model,
    prompt: userPrompt,
    schema: advancedSchema,
    system: systemPrompt,
  });

  return { data: object, systemPrompt, usage, userPrompt };
}

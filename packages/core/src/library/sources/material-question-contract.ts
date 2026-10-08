import { z } from "zod";

const MAX_QUESTION_LENGTH = 500;
const MAX_QUESTION_SOURCES = 5;
const MIN_LANGUAGE_LENGTH = 2;
const MAX_LANGUAGE_LENGTH = 10;

export const materialQuestionInputSchema = z
  .object({
    language: z
      .string()
      .min(MIN_LANGUAGE_LENGTH)
      .max(MAX_LANGUAGE_LENGTH)
      .meta({ description: "The learner's language, for the answer" }),
    question: z.string().trim().min(1).max(MAX_QUESTION_LENGTH),
    sourceIds: z
      .array(z.uuid())
      .min(1)
      .max(MAX_QUESTION_SOURCES)
      .meta({ description: "The learner's own material to answer from (`POST /v1/uploads`)" }),
  })
  .strict()
  .meta({ id: "MaterialQuestionInput" });

export type MaterialQuestionInput = z.infer<typeof materialQuestionInputSchema>;

/**
 * A page of the learner's own material that an answer or a lesson screen came from: "Aula 5,
 * slide 4". `page` is null for material without pages (Word, text).
 */
export type MaterialCitation = {
  page: number | null;
  title: string;
  unit: "page" | "section" | "slide";
};

/**
 * An answer from the learner's own material with the pages it came from. `found` is false when
 * the material doesn't cover the question: the answer then says so instead of guessing.
 */
export type MaterialQuestionAnswer = {
  answer: string;
  citations: MaterialCitation[];
  found: boolean;
};

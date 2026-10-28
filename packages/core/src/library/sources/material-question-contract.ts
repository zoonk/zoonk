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

export type MaterialCitation = {
  page: number | null;
  title: string;
  unit: "page" | "section" | "slide";
};

export type MaterialQuestionAnswer = {
  answer: string;
  citations: MaterialCitation[];
  found: boolean;
};

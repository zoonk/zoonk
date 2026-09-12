import { z } from "zod";

const MAX_DISCOVERY_TEXT_LENGTH = 8000;
const MAX_DISCOVERY_QUESTION_ID_LENGTH = 200;

export const learningRequestInputSchema = z
  .object({
    language: z.string().trim().min(2).max(10),
    prompt: z.string().trim().min(1).max(MAX_DISCOVERY_TEXT_LENGTH),
  })
  .strict();
export const discoveryAnswerInputSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    optionId: z.string().max(MAX_DISCOVERY_QUESTION_ID_LENGTH).optional(),
    otherAnswer: z.string().trim().min(1).max(MAX_DISCOVERY_TEXT_LENGTH).optional(),
    questionId: z.string().min(1).max(MAX_DISCOVERY_QUESTION_ID_LENGTH),
    skip: z.boolean().optional(),
  })
  .strict();
export type DiscoveryAnswerInput = z.infer<typeof discoveryAnswerInputSchema>;

export const discoveryRevisionInputSchema = z
  .object({
    answerIndex: z.number().int().nonnegative(),
    answerText: z.string().trim().min(1).max(MAX_DISCOVERY_TEXT_LENGTH),
    expectedRevision: z.number().int().positive(),
  })
  .strict();
export type DiscoveryRevisionInput = z.infer<typeof discoveryRevisionInputSchema>;

export const discoveryQuestionSchema = z.object({
  description: z.string(),
  id: z.string(),
  optional: z.boolean(),
  options: z.array(z.object({ description: z.string(), id: z.string(), label: z.string() })),
  question: z.string(),
});
export const discoveryBriefSchema = z.object({
  description: z.string(),
  learningGoal: z.string(),
  requirements: z.array(z.string()),
  startingKnowledge: z.string(),
  title: z.string(),
});
export const discoveryAnswersSchema = z.array(
  z.object({ answer: z.string(), question: z.string(), questionId: z.string() }),
);
export const discoveryResolutionSchema = z.object({
  brief: discoveryBriefSchema.nullable(),
  coursePromptId: z.uuid().optional(),
  format: z.enum(["core", "language", "personalized", "question"]).nullable(),
  question: discoveryQuestionSchema.nullable(),
  reusableCoursePrompt: z.string().nullable(),
  status: z.enum(["ask", "ready"]),
  targetLanguage: z.string().nullable(),
});

export type CourseDiscoveryDecision = z.infer<typeof discoveryResolutionSchema>;

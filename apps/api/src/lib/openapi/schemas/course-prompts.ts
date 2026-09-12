import {
  COURSE_LANGUAGE_MAX_LENGTH,
  COURSE_PROMPT_MAX_LENGTH,
} from "@zoonk/core/courses/prompt-contract";
import { TTS_SUPPORTED_LANGUAGE_CODES } from "@zoonk/utils/languages";
import { getLanguageSubtag } from "@zoonk/utils/locale";
import { z } from "zod";
import { courseFormatSchema, generationStatusSchema } from "./curriculum";

const unsupportedIntentSchema = z.enum(["ambiguous", "learn", "question"]);

const sourceLanguageSchema = z
  .string()
  .trim()
  .min(2)
  .max(COURSE_LANGUAGE_MAX_LENGTH)
  .refine((language) => getLanguageSubtag(language) !== null, {
    message: "Language must be a well-formed BCP 47 locale",
  })
  .meta({ description: "Well-formed BCP 47 source locale" });

export const coursePromptPathParamsSchema = z
  .object({ coursePromptId: z.uuid().meta({ description: "Course prompt ID" }) })
  .meta({ id: "CoursePromptPathParams" });

export const resolveCoursePromptRequestSchema = z
  .discriminatedUnion("kind", [
    z.object({
      kind: z.literal("topic"),
      language: sourceLanguageSchema,
      prompt: z.string().trim().min(1).max(COURSE_PROMPT_MAX_LENGTH),
    }),
    z.object({
      kind: z.literal("language"),
      language: sourceLanguageSchema,
      targetLanguage: z
        .enum(TTS_SUPPORTED_LANGUAGE_CODES)
        .meta({ description: "Target language, which must differ from the source language" }),
    }),
  ])
  .superRefine((request, context) => {
    if (
      request.kind === "language" &&
      getLanguageSubtag(request.language) === request.targetLanguage
    ) {
      context.addIssue({
        code: "custom",
        message: "Source and target languages must be different",
        path: ["targetLanguage"],
      });
    }
  })
  .meta({ id: "ResolveCoursePromptRequest" });

export const resolveCoursePromptResponseSchema = z
  .discriminatedUnion("kind", [
    z.object({ courseId: z.uuid(), kind: z.literal("course") }),
    z.object({ coursePromptId: z.uuid(), kind: z.literal("generation") }),
    z.object({ discoveryId: z.uuid(), kind: z.literal("discovery") }),
    z.object({ kind: z.literal("track"), trackId: z.uuid() }),
    z.object({ kind: z.literal("exam") }),
    z.object({ kind: z.literal("language") }),
    z.object({ kind: z.literal("unsafe") }),
    z.object({
      courseFormat: courseFormatSchema.nullable(),
      intent: unsupportedIntentSchema,
      kind: z.literal("unsupported"),
      title: z.string(),
    }),
  ])
  .meta({ id: "ResolveCoursePromptResponse" });

const coursePromptTargetSchema = z.discriminatedUnion("kind", [
  z.object({ courseId: z.uuid(), kind: z.literal("course") }),
  z.object({
    chapterId: z.uuid(),
    courseId: z.uuid(),
    kind: z.literal("lesson"),
    lessonId: z.uuid(),
  }),
]);

export const coursePromptGenerationResponseSchema = z
  .discriminatedUnion("status", [
    z.object({
      completionKind: z.literal("course"),
      courseFormat: courseFormatSchema,
      coursePromptId: z.uuid(),
      generationId: z.string().nullable(),
      generationStatus: generationStatusSchema,
      status: z.literal("pending"),
      title: z.string(),
    }),
    z.object({ status: z.literal("ready"), target: coursePromptTargetSchema }),
  ])
  .meta({ id: "CoursePromptGenerationResponse" });

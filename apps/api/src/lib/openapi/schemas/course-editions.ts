import { SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { z } from "zod";
import { generationStatusSchema } from "./curriculum";

export const courseEditionRequestSchema = z
  .object({
    language: z
      .enum(SUPPORTED_LOCALES)
      .meta({ description: "Requested instructional language", examples: ["pt"] }),
  })
  .meta({ id: "CourseEditionRequest" });

export const courseEditionResponseSchema = z
  .discriminatedUnion("kind", [
    z.object({ courseId: z.uuid(), kind: z.literal("course") }),
    z.object({
      coursePromptId: z.uuid(),
      generationStatus: generationStatusSchema,
      kind: z.literal("generation"),
    }),
    z.object({ kind: z.literal("missing") }),
    z.object({
      kind: z.literal("unsupported"),
      reason: z.enum(["sameLanguage", "format", "language", "unavailable"]),
    }),
  ])
  .meta({ id: "CourseEditionResponse" });

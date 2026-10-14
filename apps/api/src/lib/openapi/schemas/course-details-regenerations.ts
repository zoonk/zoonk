import { z } from "zod";

const MAX_PROMPT_VERSION_LENGTH = 200;

export const courseDetailsRegenerationRequestSchema = z
  .object({
    promptVersion: z
      .string()
      .trim()
      .min(1)
      .max(MAX_PROMPT_VERSION_LENGTH)
      .nullable()
      .optional()
      .meta({
        description: "Optionally restrict to a source version; null selects unversioned copy",
      }),
  })
  .strict()
  .meta({ id: "CourseDetailsRegenerationRequest" });

export const courseDetailsRegenerationResponseSchema = z
  .object({
    courseIds: z
      .array(z.uuid())
      .meta({ description: "Courses with a course-details workflow started" }),
    failed: z
      .number()
      .int()
      .nonnegative()
      .meta({ description: "Dispatch failures whose old copy was restored when unchanged" }),
  })
  .meta({ id: "CourseDetailsRegeneration" });

export const courseDetailsRegenerationPreviewSchema = z
  .object({
    batchSize: z.number().int().positive(),
    estimatedCost: z.number().nonnegative(),
    matching: z.number().int().nonnegative(),
  })
  .meta({ id: "CourseDetailsRegenerationPreview" });

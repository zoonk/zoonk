import { z } from "zod";

const generationIdSchema = z
  .string()
  .meta({
    description: "The run writing the content: stream GET /generations/{generationId}/events",
  });

export const lessonGenerationSchema = z
  .object({
    generationId: generationIdSchema.nullable(),
    status: z
      .enum(["ready", "generating"])
      .meta({
        description:
          "`ready`: play the lesson now. `generating`: follow the run's stream until `lessonReady`",
      }),
  })
  .meta({ id: "LessonGeneration" });

const readyAlternativeSchema = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("lesson"), lessonId: z.uuid(), title: z.string() }),
    z.object({
      dueSkills: z.int().min(1).meta({ description: "Skills whose reviews are due now" }),
      kind: z.literal("review"),
    }),
  ])
  .meta({ id: "ReadyAlternative" });

export const lessonReadinessSchema = z
  .object({
    alternative: readyAlternativeSchema
      .nullable()
      .meta({
        description:
          "Something ready to do instead of waiting: the plan's next written lesson, or due reviews. Null when the lesson is ready or nothing else is",
      }),
    generationId: generationIdSchema.nullable(),
    status: z
      .enum(["ready", "generating", "notStarted", "failed"])
      .meta({
        description:
          "`generating`: stream the run for live progress. `notStarted` or `failed`: POST /library/lessons/{lessonId}/generations to write it now",
      }),
  })
  .meta({ id: "LessonReadiness" });

export const sessionPreparationSchema = z
  .object({
    preparationId: z
      .string()
      .nullable()
      .meta({
        description: "The run getting this and the next session's lessons ready; null for guests",
      }),
  })
  .meta({ id: "SessionPreparation" });

export const goalGenerationSchema = z
  .object({
    generationId: generationIdSchema,
    goalId: z.uuid(),
    kind: z.enum(["curriculum", "explanation"]),
  })
  .meta({ id: "GoalGeneration" });

/** A curriculum started with its goal's research waits for it, as `POST /goals` does. */
export const goalGenerationQuerySchema = z
  .object({
    researchId: z
      .string()
      .min(1)
      .optional()
      .meta({
        description:
          "The goal's research run (from POST /research), so an exam's plan waits for its notice",
      }),
  })
  .strict();

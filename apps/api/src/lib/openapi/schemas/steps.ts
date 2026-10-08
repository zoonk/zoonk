import { z } from "zod";

const stepIdSchema = z.uuid().meta({ description: "The lesson screen's id" });

export const stepPathParamsSchema = z
  .object({ stepId: stepIdSchema })
  .meta({ id: "StepPathParams" });

export const stepExampleLineSchema = z
  .object({
    line: z
      .string()
      .nullable()
      .meta({
        description:
          "One sentence tying the screen's idea to the learner's life, or null when the screen has no slot for one or nothing the learner shared fits",
      }),
    stepId: stepIdSchema,
  })
  .meta({ id: "StepExampleLine" });

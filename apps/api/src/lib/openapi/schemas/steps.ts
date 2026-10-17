import { z } from "zod";

const stepIdSchema = z.uuid().meta({ description: "The lesson screen's id" });

export const stepPathParamsSchema = z
  .object({ stepId: stepIdSchema })
  .meta({ id: "StepPathParams" });

export const stepExampleLineSchema = z
  .object({
    canRequest: z
      .boolean()
      .meta({
        description:
          "Whether asking for the line (POST) can write one: the screen has a slot, the learner shares facts, and none was written from them yet. False once written, even as null, and when the learner shares nothing. The learner's help allowance can still refuse the request.",
      }),
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

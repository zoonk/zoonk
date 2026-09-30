import { stepContentSchemas } from "@zoonk/core/library/steps/contract";
import { LEARNER_VARIANT_KINDS } from "@zoonk/core/library/variants/contract";
import { z } from "zod";

const stepIdSchema = z.uuid().meta({ description: "The lesson screen's id" });

export const stepPathParamsSchema = z
  .object({ stepId: stepIdSchema })
  .meta({ id: "StepPathParams" });

export const stepVariantRequestSchema = z
  .object({
    kind: z
      .enum(LEARNER_VARIANT_KINDS)
      .meta({
        description: '"simpler" for the same idea in easier words, "deeper" for more detail',
      }),
  })
  .meta({ id: "StepVariantRequest" });

export const stepVariantSchema = z
  .object({
    content: z
      .union([stepContentSchemas.explanation, stepContentSchemas.workedExample])
      .meta({
        description: "The screen's content in the step contract, same kind as the original",
      }),
    id: z.uuid(),
    kind: z.enum(LEARNER_VARIANT_KINDS),
    stepId: stepIdSchema,
  })
  .meta({
    description: 'A shared "Simpler" or "Go deeper" version of an explanation or worked example',
    id: "StepVariant",
  });

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

import { z } from "zod";
import { itemAnswerInputSchema } from "../learner/contract";

/** The answers a test takes: tapped choices, matches and orders, never typed text. */
export const matchAnswerSchema = z
  .object({
    matches: z
      .array(z.number().int().min(0))
      .meta({ description: "For each left entry, the index of the right entry it was matched to" }),
  })
  .strict()
  .meta({ id: "MatchAnswer" });

export const orderAnswerSchema = z
  .object({
    order: z
      .array(z.number().int().min(0))
      .meta({
        description:
          "An ordering question's answer: the indexes of its shown steps (`options`), in the order the learner put them",
      }),
  })
  .strict()
  .meta({ id: "OrderAnswer" });

export const tapAnswerSchema = z
  .union([itemAnswerInputSchema.shape.answer, matchAnswerSchema, orderAnswerSchema])
  .meta({ id: "TapAnswer" });

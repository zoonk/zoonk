import { listeningSetViewSchema } from "@zoonk/core/library/listening/view";
import { ItemSetKind } from "@zoonk/db";
import { z } from "zod";
import { questionVisualSchema } from "./common";

/** Who said what in a recording, in order, by the names it gives. */
export const listeningTranscriptSchema = listeningSetViewSchema.shape.transcript;

/**
 * The stimulus a question shares with its set's other questions (a passage, a case, a chart or a
 * recording), shown with each of them; never an answer.
 */
export const itemSetSchema = z
  .object({
    count: z.number().int().min(1).meta({ description: "How many questions the set has" }),
    id: z.uuid(),
    kind: z.enum(ItemSetKind),
    listening: listeningSetViewSchema
      .meta({
        description:
          "A recording: its file, how many times it plays, and its transcript only once the set's questions are answered. Null for other kinds",
      })
      .nullable(),
    position: z
      .number()
      .int()
      .min(0)
      .meta({ description: "The question's place in the set, from 0" }),
    source: z.string().nullable().meta({ description: "Where a quoted text comes from" }),
    text: z
      .string()
      .nullable()
      .meta({ description: "A passage's or a case's words, or the words around a chart" }),
    title: z.string().nullable(),
    visual: questionVisualSchema,
  })
  .meta({ id: "ItemSet" });

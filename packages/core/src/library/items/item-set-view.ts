import { lessonVisualSchema } from "@zoonk/ai/tasks/v2/visuals/schema";
import { ItemSetKind } from "@zoonk/db";
import { z } from "zod";
import { listeningSetViewSchema } from "../listening/listening-set-view";

export const itemSetViewSchema = z
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
    visual: lessonVisualSchema.nullable(),
  })
  .meta({ id: "ItemSet" });

export type ItemSetView = z.infer<typeof itemSetViewSchema>;

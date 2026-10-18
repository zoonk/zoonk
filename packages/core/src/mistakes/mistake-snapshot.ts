import { lessonVisualSchema } from "@zoonk/ai/tasks/v2/visuals/schema";
import { z } from "zod";
import { itemImageSchema } from "../library/items/item-image";
import { itemSetViewSchema } from "../library/items/item-set-view";

/**
 * What the notebook keeps, so an entry stays readable after its question is regenerated or
 * deleted: the question with its stimulus, the learner's answer, the right answer, why it was wrong and the
 * misconception behind it. For true-or-false questions the answers are "true" or "false", which
 * apps show in the learner's language.
 */
export const mistakeSnapshotSchema = z
  .object({
    answer: z.string().nullable().meta({ description: "The learner's answer as text" }),
    context: z
      .string()
      .nullable()
      .optional()
      .meta({ description: "The context shown before this question, kept as the learner saw it" }),
    correctAnswer: z.string().nullable().optional(),
    explanation: z.string().nullable().optional(),
    format: z.string().optional().meta({ description: "The question's item format, when known" }),
    image: itemImageSchema.nullable().optional(),
    misconception: z.string().nullable().optional(),
    question: z.string(),
    set: itemSetViewSchema
      .nullable()
      .optional()
      .meta({
        description:
          "The shared passage, case, chart or recording shown with this question, kept with the mistake",
      }),
    visual: lessonVisualSchema.nullable().optional(),
  })
  .meta({ id: "MistakeSnapshot" });

export type MistakeSnapshot = z.infer<typeof mistakeSnapshotSchema>;

/** Adds the material the learner saw, without adding empty fields to older snapshot shapes. */
export function withMistakeStimulus({
  snapshot,
  stimulus,
}: {
  snapshot: MistakeSnapshot;
  stimulus: Pick<MistakeSnapshot, "context" | "image" | "set" | "visual">;
}): MistakeSnapshot {
  return {
    ...snapshot,
    ...(stimulus.context ? { context: stimulus.context } : {}),
    ...(stimulus.image ? { image: stimulus.image } : {}),
    ...(stimulus.set ? { set: stimulus.set } : {}),
    ...(stimulus.visual ? { visual: stimulus.visual } : {}),
  };
}

const EMPTY_SNAPSHOT: MistakeSnapshot = { answer: null, question: "" };

/** Reads a stored snapshot; rows written before a field existed simply lack it. */
export function readMistakeSnapshot(value: unknown): MistakeSnapshot {
  const snapshot = mistakeSnapshotSchema.safeParse(value);
  return snapshot.success ? snapshot.data : EMPTY_SNAPSHOT;
}

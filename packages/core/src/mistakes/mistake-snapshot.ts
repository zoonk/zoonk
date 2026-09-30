import { z } from "zod";

/**
 * What the notebook keeps as text, so an entry stays readable after its question is regenerated or
 * deleted: the question, the learner's answer, the right answer, why the answer was wrong and the
 * misconception behind it. For true-or-false questions the answers are "true" or "false", which
 * apps show in the learner's language.
 */
export const mistakeSnapshotSchema = z
  .object({
    answer: z.string().nullable().meta({ description: "The learner's answer as text" }),
    correctAnswer: z.string().nullable().optional(),
    explanation: z.string().nullable().optional(),
    format: z.string().optional().meta({ description: "The question's item format, when known" }),
    misconception: z.string().nullable().optional(),
    question: z.string(),
  })
  .meta({ id: "MistakeSnapshot" });

export type MistakeSnapshot = z.infer<typeof mistakeSnapshotSchema>;

const EMPTY_SNAPSHOT: MistakeSnapshot = { answer: null, question: "" };

/** Reads a stored snapshot; rows written before a field existed simply lack it. */
export function readMistakeSnapshot(value: unknown): MistakeSnapshot {
  const snapshot = mistakeSnapshotSchema.safeParse(value);
  return snapshot.success ? snapshot.data : EMPTY_SNAPSHOT;
}

import { type StepKind } from "@zoonk/db";
import { z } from "zod";
import { stepContentSchemas } from "../../library/steps/contract/step-contract";

export const EXERCISE_KINDS = [
  "alphabet",
  "fillBlank",
  "listening",
  "matchColumns",
  "multipleChoice",
  "reading",
  "translation",
  "vocabulary",
] as const satisfies readonly StepKind[];

export type ExerciseKind = (typeof EXERCISE_KINDS)[number];

export function isExerciseKind(kind: string): kind is ExerciseKind {
  return EXERCISE_KINDS.some((exerciseKind) => exerciseKind === kind);
}

function exerciseContentOf<TKind extends ExerciseKind, TShape extends z.ZodRawShape>(
  kind: TKind,
  shape: TShape,
) {
  return z.object({ ...shape, content: stepContentSchemas[kind], kind: z.literal(kind) });
}

/** Emit closed objects per kind; intersecting closed schemas makes strict generated clients reject each other's keys. */
export function exerciseContentWith<TShape extends z.ZodRawShape>(shape: TShape) {
  return z.discriminatedUnion("kind", [
    exerciseContentOf("alphabet", shape),
    exerciseContentOf("fillBlank", shape),
    exerciseContentOf("listening", shape),
    exerciseContentOf("matchColumns", shape),
    exerciseContentOf("multipleChoice", shape),
    exerciseContentOf("reading", shape),
    exerciseContentOf("translation", shape),
    exerciseContentOf("vocabulary", shape),
  ]);
}

import { type StepKind } from "@zoonk/db";
import { z } from "zod";
import { stepContentSchemas } from "../../library/steps/contract/step-contract";

/** The step kinds a language lesson plays as exercises, with their word banks and options. */
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

/**
 * An exercise's kind with its content, validated together, plus the fields `shape` adds: how the
 * API documents an exercise. It's one closed object per kind, since an intersection with another
 * closed object never decodes in a strict client (each side refuses the other's keys), which the
 * native apps' generated clients are.
 */
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

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

function exerciseContentOf<TKind extends ExerciseKind>(kind: TKind) {
  return z.object({ content: stepContentSchemas[kind], kind: z.literal(kind) });
}

/** An exercise's kind with its content, validated together: how the API documents an exercise. */
export const exerciseContentSchema = z.discriminatedUnion("kind", [
  exerciseContentOf("alphabet"),
  exerciseContentOf("fillBlank"),
  exerciseContentOf("listening"),
  exerciseContentOf("matchColumns"),
  exerciseContentOf("multipleChoice"),
  exerciseContentOf("reading"),
  exerciseContentOf("translation"),
  exerciseContentOf("vocabulary"),
]);

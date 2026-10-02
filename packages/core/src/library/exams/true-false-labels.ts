import { z } from "zod";
import { isNetScored } from "../../checkpoints/weekly-challenge-rules";
import { type ExamStructure } from "./blueprint-contract";

export const trueFalseLabelsSchema = z
  .enum(["rightWrong", "trueFalse"])
  .meta({
    description:
      "How true-or-false statements are answered for the goal's exam. `rightWrong`: the exam judges each statement right or wrong and a wrong answer cancels a right one, as in Cebraspe's Certo or Errado. `trueFalse`: every other goal",
    id: "TrueFalseLabels",
  });

export type TrueFalseLabels = z.infer<typeof trueFalseLabelsSchema>;

/**
 * The words a goal's true-or-false statements are answered with. Cebraspe judges statements
 * "Certo" or "Errado", and its exams are the ones where a wrong answer cancels a right one, so the
 * exam's own scoring decides it rather than the board's name. Placement, drills, checkpoints,
 * mocks and the mistakes notebook all label statements from here.
 */
export function getTrueFalseLabels(structure: ExamStructure | null): TrueFalseLabels {
  return isNetScored(structure) ? "rightWrong" : "trueFalse";
}

import { normalizeString } from "@zoonk/utils/string";
import { z } from "zod";
import { type ExamStructure } from "./blueprint-contract";

export const trueFalseLabelsSchema = z
  .enum(["rightWrong", "trueFalse"])
  .meta({
    description:
      "How true-or-false statements are answered for the goal's exam. `rightWrong`: the exam's notice names the answers right or wrong, as Cebraspe's Certo or Errado. `trueFalse`: every other goal",
    id: "TrueFalseLabels",
  });

export type TrueFalseLabels = z.infer<typeof trueFalseLabelsSchema>;

/** How a notice names Cebraspe's answers ("each item will be judged CERTO or ERRADO", right or wrong). */
const RIGHT_WRONG = /\bcerto\b.*\berrado\b/su;

/** Whether the exam's statement format names its answers "certo" or "errado". */
function namesRightWrong(formats: ExamStructure["formats"]): boolean {
  return formats.some(
    (format) =>
      format.kind === "trueFalse" &&
      RIGHT_WRONG.test(normalizeString(`${format.description} ${format.citation.passage}`)),
  );
}

/**
 * The words a goal's true-or-false statements are answered with, from the notice's own words:
 * Cebraspe's notices judge statements right or wrong. A penalty for wrong answers never
 * decides it (JEE's statements stay true or false), nor the board's name, so the first pass over
 * a new notice (only its formats, before its blueprint is linked) already labels placement's first
 * statements as the exam does. Placement, drills, checkpoints, mocks and the mistakes notebook all
 * label statements from here.
 */
export function getTrueFalseLabels(
  structure: (Pick<ExamStructure, "formats"> & Partial<Pick<ExamStructure, "mock">>) | null,
): TrueFalseLabels {
  return namesRightWrong(structure?.formats ?? []) ? "rightWrong" : "trueFalse";
}

import { normalizeString } from "@zoonk/utils/string";
import { z } from "zod";
import { isNetScored } from "../../checkpoints/weekly-challenge-rules";
import { type ExamStructure } from "./blueprint-contract";

export const trueFalseLabelsSchema = z
  .enum(["rightWrong", "trueFalse"])
  .meta({
    description:
      "How true-or-false statements are answered for the goal's exam. `rightWrong`: the exam judges each statement right or wrong, as in Cebraspe's Certo or Errado (its notice names the answers so, or a wrong answer cancels a right one). `trueFalse`: every other goal",
    id: "TrueFalseLabels",
  });

export type TrueFalseLabels = z.infer<typeof trueFalseLabelsSchema>;

/** How a notice names Cebraspe's answers ("O julgamento de cada item será CERTO ou ERRADO"). */
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
 * The words a goal's true-or-false statements are answered with. Cebraspe judges statements
 * "Certo" or "Errado": its exams are the ones where a wrong answer cancels a right one, and its
 * notices name the answers so. Either decides it rather than the board's name, so the first pass
 * over a new notice (only its formats, before its blueprint is linked) already labels placement's
 * first statements as the exam does. Placement, drills, checkpoints, mocks and the mistakes
 * notebook all label statements from here.
 */
export function getTrueFalseLabels(
  structure: (Pick<ExamStructure, "formats"> & Partial<Pick<ExamStructure, "mock">>) | null,
): TrueFalseLabels {
  return isNetScored(structure) || namesRightWrong(structure?.formats ?? [])
    ? "rightWrong"
    : "trueFalse";
}

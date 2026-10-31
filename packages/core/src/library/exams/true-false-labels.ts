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

const RIGHT_WRONG = /\bcerto\b.*\berrado\b/su;

function namesRightWrong(formats: ExamStructure["formats"]): boolean {
  return formats.some(
    (format) =>
      format.kind === "trueFalse" &&
      RIGHT_WRONG.test(normalizeString(`${format.description} ${format.citation.passage}`)),
  );
}

export function getTrueFalseLabels(
  structure: (Pick<ExamStructure, "formats"> & Partial<Pick<ExamStructure, "mock">>) | null,
): TrueFalseLabels {
  return namesRightWrong(structure?.formats ?? []) ? "rightWrong" : "trueFalse";
}

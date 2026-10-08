import { type ExamStructure } from "./blueprint-contract";

/** A notice may set a minimum per test and one overall; more than this is the fine print. */
const MAX_PASS_MARKS = 3;

/**
 * What it takes to pass, as the notice says it ("Aprovado com no mínimo 40 dos 80 pontos
 * (50%)."): its rules read as pass marks, in its order. Empty for notices read before rules had
 * kinds, and for exams without a pass mark.
 */
export function getPassMarks(structure: ExamStructure): string[] {
  return structure.rules
    .filter((rule) => rule.kind === "passMark")
    .slice(0, MAX_PASS_MARKS)
    .map((rule) => rule.text);
}

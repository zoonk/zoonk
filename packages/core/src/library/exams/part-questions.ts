import { type ExamStructure } from "./blueprint-contract";

export function getPartQuestions({
  name,
  structure,
}: {
  name: string;
  structure: ExamStructure;
}): number | null {
  const scoring = structure.mock?.scoring;
  const stated = scoring?.parts?.find((part) => part.name === name)?.questions;

  if (stated) {
    return stated;
  }

  const rows = (scoring?.marking ?? []).filter((row) => row.part === name);

  return rows.length > 0 && rows.every((row) => row.questions !== null)
    ? rows.reduce((sum, row) => sum + (row.questions ?? 0), 0)
    : null;
}

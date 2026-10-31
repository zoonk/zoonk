import { type ExamStructure } from "./blueprint-contract";

type CoveredSubject = Pick<ExamStructure["subjects"][number], "group" | "name" | "partOf">;

/**
 * A final-score term covers each subject it names, the subjects of each group it names, and their
 * parts.
 */
export function coversSubject({
  parts,
  subject,
}: {
  parts: readonly string[];
  subject: CoveredSubject;
}): boolean {
  return [subject.name, subject.group, subject.partOf].some(
    (name) => typeof name === "string" && parts.includes(name),
  );
}

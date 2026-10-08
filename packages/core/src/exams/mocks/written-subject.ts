import { normalizeString } from "@zoonk/utils/string";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { isWrittenSection } from "./mock-plan";

/** A subject that is itself a written test ("Prova discursiva", "Redação"), not "Redação oficial". */
const WRITTEN_SUBJECT_NAME =
  /^(?:prova\s+)?(?:discursiva|reda[cç][aã]o|essay|pe[cç]a t[eé]cnica)$/iu;

/**
 * Whether a notice subject is one of its written tests (a discursive test, a redação) rather than
 * a body of knowledge: named or grouped as a written section of the exam, or, with no questions of
 * its own, named like a written test.
 */
export function isWrittenSubject({
  structure,
  subject,
}: {
  structure: ExamStructure;
  subject: Pick<ExamStructure["subjects"][number], "group" | "name" | "questions">;
}): boolean {
  const names = new Set([subject.name, subject.group ?? ""].map((name) => normalizeString(name)));

  const isWrittenSectionName = (structure.mock?.sections ?? []).some(
    (section) =>
      isWrittenSection({ section, structure }) && names.has(normalizeString(section.name)),
  );

  return (
    isWrittenSectionName ||
    (subject.questions === null && WRITTEN_SUBJECT_NAME.test(subject.name.trim()))
  );
}

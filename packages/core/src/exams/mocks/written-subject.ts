import { normalizeString } from "@zoonk/utils/string";
import { type ExamStructure } from "../../library/exams/blueprint-contract";

type StructureSection = NonNullable<ExamStructure["mock"]>["sections"][number];

/** How a written test is named, for readings from before sections had kinds. */
const WRITTEN_SECTION_NAME =
  /discursiv|reda[cç][aã]o|pe[cç]a t[eé]cnica|essay|written|free.?response|escrit/iu;

/**
 * Whether a section is answered in writing: as its reading says, or, for a reading from before
 * sections had kinds, a section without a question count, named like a written test, in an exam
 * with an essay format.
 */
export function isWrittenSection({
  section,
  structure,
}: {
  section: StructureSection;
  structure: ExamStructure | null;
}): boolean {
  if (section.kind) {
    return section.kind === "written";
  }

  const hasEssay = structure?.formats.some((format) => format.kind === "essay") ?? false;
  return section.questions === null && hasEssay && WRITTEN_SECTION_NAME.test(section.name);
}

/**
 * Whether a section asks objective questions a mock fills from the bank: as its reading says, or,
 * for a reading from before sections had kinds, any section that isn't written. Listening,
 * speaking and practical sections never take bank questions in their place.
 */
export function isObjectiveSection({
  section,
  structure,
}: {
  section: StructureSection;
  structure: ExamStructure | null;
}): boolean {
  return section.kind ? section.kind === "objective" : !isWrittenSection({ section, structure });
}

const WRITTEN_TEST = String.raw`(?:prova\s+)?(?:discursiva|reda[cç][aã]o|essay|pe[cç]a t[eé]cnica)`;

/**
 * A subject that is itself a written test (a discursive test, an essay or a legal brief), not one
 * that teaches official writing, named alone or with another name for it ("Discursiva (redação)").
 */
const WRITTEN_SUBJECT_NAME = new RegExp(`^${WRITTEN_TEST}(?:\\s*\\(${WRITTEN_TEST}\\))?$`, "iu");

/**
 * Whether a notice subject is one of its written tests (a discursive test, an essay) rather than
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

/** Section kinds sat some other way than written questions: recordings, talks, a practical test. */
const PAPER_KINDS = new Set<StructureSection["kind"]>(["listening", "practical", "speaking"]);

/**
 * Whether a notice subject is asked with the bank's written questions: not one of its written tests
 * (`isWrittenSubject`), and not a paper sat another way, named like a listening, speaking or
 * practical section of the exam (IELTS's "Listening" plays recordings; "Speaking" is a talk).
 */
export function isQuestionSubject({
  structure,
  subject,
}: {
  structure: ExamStructure;
  subject: Pick<ExamStructure["subjects"][number], "group" | "name" | "questions">;
}): boolean {
  const names = new Set([subject.name, subject.group ?? ""].map((name) => normalizeString(name)));

  const isPaper = (structure.mock?.sections ?? []).some(
    (section) => PAPER_KINDS.has(section.kind) && names.has(normalizeString(section.name)),
  );

  return !isPaper && !isWrittenSubject({ structure, subject });
}

import { normalizeString } from "@zoonk/utils/string";
import { type ExamStructure } from "../../library/exams/blueprint-contract";

type StructureSection = NonNullable<ExamStructure["mock"]>["sections"][number];

export function isObjectiveSection(section: StructureSection): boolean {
  return section.kind === undefined || section.kind === "objective";
}

const WRITTEN_TEST = String.raw`(?:prova\s+)?(?:discursiva|reda[cç][aã]o|essay|pe[cç]a t[eé]cnica)`;

const WRITTEN_SUBJECT_NAME = new RegExp(`^${WRITTEN_TEST}(?:\\s*\\(${WRITTEN_TEST}\\))?$`, "iu");

export function isWrittenSubject({
  structure,
  subject,
}: {
  structure: ExamStructure;
  subject: Pick<ExamStructure["subjects"][number], "group" | "name" | "questions">;
}): boolean {
  const names = new Set([subject.name, subject.group ?? ""].map((name) => normalizeString(name)));

  const isWrittenSectionName = (structure.mock?.sections ?? []).some(
    (section) => section.kind === "written" && names.has(normalizeString(section.name)),
  );

  return (
    isWrittenSectionName ||
    (subject.questions === null && WRITTEN_SUBJECT_NAME.test(subject.name.trim()))
  );
}

const PAPER_KINDS = new Set<StructureSection["kind"]>(["listening", "practical", "speaking"]);

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

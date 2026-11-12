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

const PAPER_KINDS = ["listening", "practical", "speaking"] as const;

type PaperKind = (typeof PAPER_KINDS)[number];

type NamedSubject = Pick<ExamStructure["subjects"][number], "group" | "name" | "questions">;

/** The kind of paper a subject is sat as when it isn't questions on a page; null for those. */
export function getPaperKind({
  structure,
  subject,
}: {
  structure: ExamStructure;
  subject: NamedSubject;
}): PaperKind | null {
  const names = new Set([subject.name, subject.group ?? ""].map((name) => normalizeString(name)));

  const paper = (structure.mock?.sections ?? []).find(
    (section) =>
      PAPER_KINDS.some((kind) => kind === section.kind) && names.has(normalizeString(section.name)),
  );

  return PAPER_KINDS.find((kind) => kind === paper?.kind) ?? null;
}

export function isQuestionSubject({
  structure,
  subject,
}: {
  structure: ExamStructure;
  subject: NamedSubject;
}): boolean {
  return getPaperKind({ structure, subject }) === null && !isWrittenSubject({ structure, subject });
}

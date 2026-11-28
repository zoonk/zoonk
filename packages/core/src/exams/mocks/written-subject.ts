import { listSubjectGroups } from "@zoonk/utils/exam-groups";
import { normalizeString } from "@zoonk/utils/string";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { getPartQuestions } from "../../library/exams/part-questions";

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
  subject: Pick<ExamStructure["subjects"][number], "choiceGroup" | "group" | "name" | "questions">;
}): boolean {
  const choice = subject.questions === null ? (subject.choiceGroup ?? "") : "";

  const names = new Set(
    [subject.name, subject.group ?? "", choice].map((name) => normalizeString(name)),
  );

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

type NamedSubject = Pick<
  ExamStructure["subjects"][number],
  "choiceGroup" | "group" | "name" | "otherGroups" | "questions"
>;

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
  return getPaperKind({ structure, subject }) === null && !isWrittenOnly({ structure, subject });
}

/** A part is written when every subject it groups sits a written test, or a written section has its name. */
export function isWrittenPart({ name, structure }: { name: string; structure: ExamStructure }) {
  const subjects = structure.subjects.filter(
    (subject) => subject.group === name || subject.name === name,
  );

  return subjects.length > 0
    ? subjects.every((subject) => isWrittenSubject({ structure, subject }))
    : (structure.mock?.sections ?? []).some(
        (section) => section.kind === "written" && section.name === name,
      );
}

function isQuestionPart({ name, structure }: { name: string; structure: ExamStructure }) {
  return getPartQuestions({ name, structure }) !== null && !isWrittenPart({ name, structure });
}

/**
 * The part a subject's questions sit in. A subject one test asks as questions and another as a
 * written test is asked as questions in the one that counts questions and isn't written.
 */
export function getQuestionGroup({
  structure,
  subject,
}: {
  structure: ExamStructure;
  subject: Pick<ExamStructure["subjects"][number], "group" | "otherGroups">;
}): string | null {
  const groups = listSubjectGroups(subject);

  if (groups.length <= 1) {
    return subject.group ?? null;
  }

  return groups.find((name) => isQuestionPart({ name, structure })) ?? groups[0] ?? null;
}

export function isWrittenOnly({
  structure,
  subject,
}: {
  structure: ExamStructure;
  subject: NamedSubject;
}): boolean {
  return (
    isWrittenSubject({ structure, subject }) &&
    !(subject.otherGroups ?? []).some((name) => isQuestionPart({ name, structure }))
  );
}

import { listSubjectGroups } from "@zoonk/utils/exam-groups";
import { type ExamStructure } from "./blueprint-contract";

type Subject = ExamStructure["subjects"][number];

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

/**
 * The part a subject's questions sit in. A subject one test asks as questions and another as a
 * written test is asked as questions in the one that counts questions.
 */
export function getQuestionGroup({
  structure,
  subject,
}: {
  structure: ExamStructure;
  subject: Pick<Subject, "group" | "otherGroups">;
}): string | null {
  const groups = listSubjectGroups(subject);

  if (groups.length <= 1) {
    return subject.group ?? null;
  }

  return groups.find((name) => getPartQuestions({ name, structure }) !== null) ?? groups[0] ?? null;
}

export function isAlsoAskedAsQuestions({
  structure,
  subject,
}: {
  structure: ExamStructure;
  subject: Pick<Subject, "otherGroups">;
}): boolean {
  return (subject.otherGroups ?? []).some((name) => getPartQuestions({ name, structure }) !== null);
}

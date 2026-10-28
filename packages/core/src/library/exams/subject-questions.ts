import { MS_PER_DAY } from "@zoonk/utils/date";
import { normalizeString } from "@zoonk/utils/string";
import { isWrittenSubject } from "../../exams/mocks/written-subject";
import { type ExamStructure } from "./blueprint-contract";

type Subject = ExamStructure["subjects"][number];

const RETRY_AFTER_DAYS = 30;

const MIN_SUBJECTS = 3;

const OBJECTIVE_FORMATS: ReadonlySet<ExamStructure["formats"][number]["kind"]> = new Set([
  "multipleChoice",
  "trueFalse",
]);

type PastQuestions = NonNullable<ExamStructure["pastQuestions"]>;

function findCount({
  past,
  subject,
}: {
  past: PastQuestions | null | undefined;
  subject: Subject;
}) {
  const name = normalizeString(subject.name);
  return past?.subjects.find((item) => normalizeString(item.name) === name);
}

function findPastCount({ structure, subject }: { structure: ExamStructure; subject: Subject }) {
  return findCount({ past: structure.pastQuestions, subject });
}

export function countsEverySubject({
  past,
  subjects,
}: {
  past: PastQuestions;
  subjects: readonly Subject[];
}): boolean {
  return subjects.every((subject) => findCount({ past, subject }));
}

export function getSubjectQuestions({
  structure,
  subject,
}: {
  structure: ExamStructure;
  subject: Subject;
}): number | null {
  if (subject.questions !== null) {
    return subject.questions;
  }

  return isWrittenSubject({ structure, subject })
    ? null
    : (findPastCount({ structure, subject })?.questions ?? null);
}

export function getPastQuestionsSource(
  structure: ExamStructure,
): { edition: string | null; title: string | null; url: string } | null {
  const past = structure.pastQuestions;

  const counted =
    past?.source &&
    structure.subjects.some(
      (subject) => subject.questions === null && findPastCount({ structure, subject }),
    );

  return counted && past.source ? { edition: past.edition, ...past.source } : null;
}

function isRecent({ checkedAt, now }: { checkedAt: string; now: Date }): boolean {
  return now.getTime() - new Date(checkedAt).getTime() < RETRY_AFTER_DAYS * MS_PER_DAY;
}

export function needsPastQuestions({
  now,
  structure,
}: {
  now: Date;
  structure: ExamStructure;
}): boolean {
  const { pastQuestions, subjects } = structure;

  const isWeighed = subjects.some(
    (subject) => subject.questions !== null || subject.weight !== null,
  );

  const isObjective = structure.formats.some((format) => OBJECTIVE_FORMATS.has(format.kind));

  if (subjects.length < MIN_SUBJECTS || isWeighed || !isObjective) {
    return false;
  }

  if (!pastQuestions) {
    return true;
  }

  return (
    !countsEverySubject({ past: pastQuestions, subjects }) &&
    !isRecent({ checkedAt: pastQuestions.checkedAt, now })
  );
}

export function orderByQuestions<T extends { group?: string | null; questions: number | null }>(
  subjects: readonly T[],
): T[] {
  const isCounted = subjects.every((subject) => subject.questions !== null);
  const isGrouped = subjects.some((subject) => subject.group);

  if (!isCounted || isGrouped) {
    return [...subjects];
  }

  return subjects.toSorted((first, second) => (second.questions ?? 0) - (first.questions ?? 0));
}

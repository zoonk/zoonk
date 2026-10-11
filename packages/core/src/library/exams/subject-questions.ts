import { MS_PER_DAY } from "@zoonk/utils/date";
import { normalizeString } from "@zoonk/utils/string";
import { isWrittenSubject } from "../../exams/mocks/written-subject";
import { type ExamStructure } from "./blueprint-contract";

type Subject = ExamStructure["subjects"][number];

/** A lookup that found nothing is tried again after this long: a source may publish the counts. */
const RETRY_AFTER_DAYS = 30;

/** Fewer subjects than this are weighed by the notice's own sections well enough. */
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

/**
 * Whether a lookup counted every one of these subjects. A lookup may count some only (its source
 * counts a subject the notice's reading named otherwise, or none it missed): a reading that
 * changes the subjects then asks again for the new ones (see `keepPastQuestions`).
 */
export function countsEverySubject({
  past,
  subjects,
}: {
  past: PastQuestions;
  subjects: readonly Subject[];
}): boolean {
  return subjects.every((subject) => findCount({ past, subject }));
}

/**
 * A subject's questions: the notice's own count, or, when the notice gives none, its count in the
 * exam's latest edition (`pastQuestions`), so the plan, its coverage and every screen weigh the
 * subjects the way candidates do. Null when neither says, and for a written test (ENEM's essay, a
 * discursive test) the notice doesn't count: a lookup lists it with 0 questions, which says
 * nothing of what it's worth, and read as a count it left ENEM's essay out of the plan's time.
 */
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

/** Where subjects' counts came from when the notice gives none, for the line that cites it. */
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

/**
 * Whether research looks up the subjects' counts in the latest editions: an objective exam with
 * several subjects whose notice gives none of their counts or weights, not looked up yet, or
 * looked up a month ago without a count for every subject (a source may publish them by then). A
 * reading that renames the subjects drops the lookup it doesn't cover (`keepPastQuestions`).
 */
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

/**
 * Subjects in the order candidates think of them. A notice that lists every subject in one test
 * without grouping them is read by weight: the subjects with the most questions first (the OAB's
 * ethics, with 8, before financial law, with 2), ties in the notice's order. A notice that
 * groups its subjects (P1, P2), or doesn't count every one, keeps its own order.
 */
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

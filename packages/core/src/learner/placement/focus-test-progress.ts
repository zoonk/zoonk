import { type TestAnswer } from "./_utils/placement-evidence";
import {
  MAX_SUBJECT_QUESTIONS,
  type SittingKind,
  getPaceMs,
  hasUnknownStreak,
} from "./focus-test-rules";
import { type FocusTestRecord } from "./focus-test-state";
import { type TestSubject } from "./focus-test-subjects";

export type SubjectProgress = TestSubject & {
  /** Test answers on each of its plan areas, in the order of `areas`. */
  areaAnswers: number[];
  asked: number;
  /** One of its test answers was wrong or "I don't know yet". */
  missed: boolean;
  right: number;
  /** Its answers in the open sitting. */
  sittingAnswers: number;
};

type SittingProgress = {
  answered: number;
  id: string;
  kind: SittingKind;
  left: number;
  manyUnknown: boolean;
  questions: number;
};

export type TestProgress = {
  answers: number;
  paceMs: number;
  sitting: SittingProgress | null;
  subjects: SubjectProgress[];
};

type AnswerPlace = { area: string | null; subject: string | null };

function getSittingAnswers({
  record,
  testAnswers,
}: {
  record: FocusTestRecord | null;
  testAnswers: readonly TestAnswer[];
}): TestAnswer[] {
  const startedAt = record?.sitting ? new Date(record.sitting.startedAt) : null;

  return startedAt
    ? testAnswers.filter((answer) => answer.standalone && answer.answeredAt >= startedAt)
    : [];
}

function toSubjectProgress({
  inSitting,
  placeOf,
  subject,
  testAnswers,
}: {
  inSitting: readonly TestAnswer[];
  placeOf: (skillId: string) => AnswerPlace;
  subject: TestSubject;
  testAnswers: readonly TestAnswer[];
}): SubjectProgress {
  const isOwn = (answer: TestAnswer) => placeOf(answer.skillId).subject === subject.key;
  const own = testAnswers.filter((answer) => isOwn(answer));

  return {
    ...subject,
    areaAnswers: subject.areas.map(
      (area) => own.filter((answer) => placeOf(answer.skillId).area === area).length,
    ),
    asked: own.length,
    missed: own.some((answer) => answer.outcome !== "correct"),
    right: own.filter((answer) => answer.outcome === "correct").length,
    sittingAnswers: inSitting.filter((answer) => isOwn(answer)).length,
  };
}

/** `testAnswers` oldest first; `placeOf` says which subject and plan area a skill's answers count for. */
export function getTestProgress({
  placeOf,
  record,
  subjects,
  testAnswers,
}: {
  placeOf: (skillId: string) => AnswerPlace;
  record: FocusTestRecord | null;
  subjects: readonly TestSubject[];
  testAnswers: readonly TestAnswer[];
}): TestProgress {
  const inSitting = getSittingAnswers({ record, testAnswers });
  const sitting = record?.sitting ?? null;

  return {
    answers: testAnswers.length,
    paceMs: getPaceMs(testAnswers.map((answer) => answer.durationMs)),
    sitting: sitting && {
      answered: inSitting.length,
      id: sitting.id,
      kind: sitting.kind,
      left: Math.max(0, sitting.questions - inSitting.length),
      manyUnknown: hasUnknownStreak(inSitting.map((answer) => answer.outcome)),
      questions: sitting.questions,
    },
    subjects: subjects.map((subject) =>
      toSubjectProgress({ inSitting, placeOf, subject, testAnswers }),
    ),
  };
}

/**
 * The plan areas to ask now: subjects with no answer first, then the heaviest, then the notice's
 * order, leaving out what quick questions can't check and a subject asked four times this sitting.
 */
export function getAreaOrder(subjects: readonly SubjectProgress[]): string[] {
  return subjects
    .map((subject, index) => ({ index, subject }))
    .filter(
      ({ subject }) => subject.part === null && subject.sittingAnswers < MAX_SUBJECT_QUESTIONS,
    )
    .toSorted(
      (a, b) =>
        Math.min(a.subject.asked, 1) - Math.min(b.subject.asked, 1) ||
        b.subject.share - a.subject.share ||
        a.index - b.index,
    )
    .flatMap(({ subject }) =>
      subject.areas
        .map((area, index) => ({ answers: subject.areaAnswers[index] ?? 0, area }))
        .toSorted((a, b) => a.answers - b.answers)
        .map(({ area }) => area),
    );
}

/** The plan areas of the subjects quick questions can check that have no test answer yet. */
export function listUnaskedAreas({
  areaOf,
  subjects,
  testAnswers,
}: {
  areaOf: (skillId: string) => string | null;
  subjects: readonly TestSubject[];
  testAnswers: readonly TestAnswer[];
}): Set<string> {
  const answered = new Set(testAnswers.map((answer) => areaOf(answer.skillId)));

  return new Set(
    subjects
      .filter(
        (subject) => subject.part === null && !subject.areas.some((area) => answered.has(area)),
      )
      .flatMap((subject) => subject.areas),
  );
}

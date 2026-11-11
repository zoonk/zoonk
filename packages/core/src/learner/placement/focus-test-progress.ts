import { type TestSkillAnswers } from "./_utils/placement-evidence";
import {
  MAX_SUBJECT_QUESTIONS,
  type SittingKind,
  getPaceMs,
  hasUnknownStreak,
} from "./focus-test-rules";
import { type FocusTestRecord } from "./focus-test-state";
import { type TestSubject } from "./focus-test-subjects";
import { type SkillStatuses } from "./placement-status";

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

function toSubjectProgress({
  placeOf,
  subject,
  testSkills,
}: {
  placeOf: (skillId: string) => AnswerPlace;
  subject: TestSubject;
  testSkills: readonly TestSkillAnswers[];
}): SubjectProgress {
  const isOwn = (answer: TestSkillAnswers) => placeOf(answer.skillId).subject === subject.key;
  const own = testSkills.filter((answer) => isOwn(answer));

  return {
    ...subject,
    areaAnswers: subject.areas.map((area) =>
      own
        .filter((answer) => placeOf(answer.skillId).area === area)
        .reduce((sum, answer) => sum + answer.answered, 0),
    ),
    asked: own.reduce((sum, answer) => sum + answer.answered, 0),
    missed: own.some((answer) => answer.right < answer.answered),
    right: own.reduce((sum, answer) => sum + answer.right, 0),
    sittingAnswers: own.reduce((sum, answer) => sum + answer.sittingAnswers, 0),
  };
}

/** `placeOf` says which subject and plan area a skill's answers count for. */
export function getTestProgress({
  sittingOutcomes,
  placeOf,
  record,
  subjects,
  testSkills,
}: {
  placeOf: (skillId: string) => AnswerPlace;
  record: FocusTestRecord | null;
  subjects: readonly TestSubject[];
  testSkills: readonly TestSkillAnswers[];
  sittingOutcomes: readonly ("correct" | "dontKnow" | "wrong")[];
}): TestProgress {
  const answered = testSkills.reduce((sum, skill) => sum + skill.answered, 0);
  const durationMs = testSkills.reduce((sum, skill) => sum + skill.durationMs, 0);
  const sittingAnswers = testSkills.reduce((sum, skill) => sum + skill.sittingAnswers, 0);
  const sitting = record?.sitting ?? null;

  return {
    answers: answered,
    paceMs: getPaceMs({ answers: answered, durationMs }),
    sitting: sitting && {
      answered: sittingAnswers,
      id: sitting.id,
      kind: sitting.kind,
      left: Math.max(0, sitting.questions - sittingAnswers),
      manyUnknown: hasUnknownStreak(sittingOutcomes),
      questions: sitting.questions,
    },
    subjects: subjects.map((subject) => toSubjectProgress({ placeOf, subject, testSkills })),
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
  testSkills,
}: {
  areaOf: (skillId: string) => string | null;
  subjects: readonly TestSubject[];
  testSkills: readonly TestSkillAnswers[];
}): Set<string> {
  const answered = new Set(testSkills.map((answer) => areaOf(answer.skillId)));

  return new Set(
    subjects
      .filter(
        (subject) => subject.part === null && !subject.areas.some((area) => answered.has(area)),
      )
      .flatMap((subject) => subject.areas),
  );
}

/** An inferred starting point cannot replace a subject's own test answer. */
export function getTestQuestionStatuses({
  areaOf,
  statuses,
  subjects,
  testSkills,
}: {
  areaOf: (skillId: string) => string | null;
  statuses: SkillStatuses;
  subjects: readonly TestSubject[];
  testSkills: readonly TestSkillAnswers[];
}): SkillStatuses {
  const unasked = listUnaskedAreas({ areaOf, subjects, testSkills });

  return new Map(
    [...statuses].map(([skillId, status]) => [
      skillId,
      unasked.has(areaOf(skillId) ?? "") && (status === "known" || status === "unknown")
        ? "unsure"
        : status,
    ]),
  );
}

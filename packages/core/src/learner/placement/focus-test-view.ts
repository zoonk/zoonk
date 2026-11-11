import { type PlanChangeView } from "../../plans/plan-view-contract";
import {
  type FocusRow,
  type FocusTestFocus,
  type FocusTestOffer,
  type FocusTestSitting,
  type FocusTestSubject,
  type FocusTestView,
  type SessionQuestions,
} from "./focus-test-contract";
import { type SubjectProgress, type TestProgress } from "./focus-test-progress";
import { getSittingMinutes, getSittingQuestions, rankFocus } from "./focus-test-rules";
import { type FocusTestSummaryRecord } from "./focus-test-state";
import { isSameFocus } from "./focus-test-summary";
import { PRIOR_BELIEF, type SkillBeliefs } from "./placement-beliefs";

function toSubjectName(subject: SubjectProgress) {
  return { key: subject.key, name: subject.name, shortName: subject.shortName };
}

function getSubjectState(subject: SubjectProgress): FocusTestSubject["state"] {
  if (subject.part) {
    return "notChecked";
  }

  return subject.asked > 0 ? "answered" : "notAsked";
}

function toSubjectView(subject: SubjectProgress): FocusTestSubject {
  return {
    ...toSubjectName(subject),
    asked: subject.asked,
    dontKnow: subject.dontKnow,
    part: subject.part,
    right: subject.right,
    state: getSubjectState(subject),
  };
}

function getMeanBelief({
  beliefs,
  skillIds,
}: {
  beliefs: SkillBeliefs;
  skillIds: readonly string[];
}): number {
  const known = skillIds.flatMap((skillId) => beliefs.get(skillId) ?? []);

  return known.length === 0
    ? PRIOR_BELIEF
    : known.reduce((sum, belief) => sum + belief, 0) / known.length;
}

/**
 * `beliefs` must come from real answers alone (no stated level, no ticked subjects), so a tick never
 * lowers a subject's need; `skillsOf` lists the topics of a subject that quick questions can check.
 */
export function listFocusRows({
  beliefs,
  skillsOf,
  subjects,
}: {
  beliefs: SkillBeliefs;
  skillsOf: (subject: SubjectProgress) => readonly string[];
  subjects: readonly SubjectProgress[];
}): FocusRow[] {
  const ranked = rankFocus(
    subjects.map((subject) => ({
      asked: subject.asked > 0,
      belief: getMeanBelief({ beliefs, skillIds: skillsOf(subject) }),
      key: subject.key,
      minimumScore: subject.minimumScore,
      missed: subject.missed,
      part: subject.part,
      share: subject.share,
    })),
  );

  return ranked.flatMap(({ key, reason }) => {
    const subject = subjects.find((candidate) => candidate.key === key);

    return subject
      ? [
          {
            areas: subject.areas,
            part: reason === "notChecked" ? subject.part : null,
            reason,
            subject: toSubjectName(subject),
          },
        ]
      : [];
  });
}

export type FocusPlan = {
  /** The plan already gives the suggested subjects their time, so a focus on them changes nothing. */
  covered: boolean;
  focusAreas: readonly string[];
  handPicked: boolean;
  /** The test's waiting proposal on this plan. */
  proposal: PlanChangeView | null;
  /** The daily time is saved, so the test proposes its focus; before that, saving the time sets it. */
  timeSaved: boolean;
  /** The plan's time doesn't cover everything by its date. */
  timeShort: boolean;
};

function getFocusState({
  plan,
  suggested,
}: {
  plan: FocusPlan;
  suggested: readonly string[];
}): FocusTestFocus["state"] | null {
  if (!plan.timeSaved) {
    return "ifTimeShort";
  }

  if (!plan.timeShort) {
    return null;
  }

  if (plan.proposal) {
    return "proposed";
  }

  if (isSameFocus(plan.focusAreas, suggested)) {
    return "current";
  }

  if (plan.handPicked) {
    return "handPicked";
  }

  return plan.covered && plan.focusAreas.length === 0 ? "alreadyFits" : null;
}

export function toFocus({
  plan,
  rows,
}: {
  plan: FocusPlan;
  rows: FocusRow[];
}): FocusTestFocus | null {
  const state = getFocusState({ plan, suggested: rows.flatMap((row) => row.areas) });

  if (rows.length === 0 || state === null) {
    return null;
  }

  return {
    basis: rows.some((row) => row.reason === "answers") ? "answers" : "importance",
    proposal: state === "proposed" ? plan.proposal : null,
    rows,
    state,
  };
}

/** What the sitting can still do, from what the engine found to ask next. */
export type AskingNow = {
  /** The subject of the question to ask; null when there is none. */
  nextSubject: string | null;
  /** Nothing useful is left to ask in the subjects quick questions can check. */
  settled: boolean;
  /** The question to ask next is still being written. */
  waiting: boolean;
};

function getSittingEnd({
  asking,
  left,
}: {
  asking: AskingNow;
  left: number;
}): FocusTestSitting["end"] {
  if (left <= 0) {
    return "ceiling";
  }

  if (asking.settled) {
    return "settled";
  }

  return asking.nextSubject !== null || asking.waiting ? null : "noQuestionsReady";
}

function toSitting({
  asking,
  progress,
}: {
  asking: AskingNow;
  progress: TestProgress;
}): FocusTestSitting | null {
  const { paceMs, sitting, subjects } = progress;

  if (!sitting) {
    return null;
  }

  const next = subjects.find((subject) => subject.key === asking.nextSubject);

  return {
    answered: sitting.answered,
    end: getSittingEnd({ asking, left: sitting.left }),
    hint: sitting.manyUnknown ? "manyUnknown" : null,
    kind: sitting.kind,
    left: sitting.left,
    minutes: getSittingMinutes({ paceMs, questions: sitting.left }),
    questions: sitting.questions,
    subject: next ? toSubjectName(next) : null,
  };
}

/**
 * The sitting a start opens now. A sitting with no answer yet is still offered as it was promised,
 * so the invitation reads the same after "Start"; null once it has an answer, and when nothing
 * can be asked.
 */
export function getOffer({
  askable,
  openSubjects,
  progress,
}: {
  /** A start has something to ask: a question is ready, being written, or about to be. */
  askable: boolean;
  /** Subjects quick questions can check that still have something to ask. */
  openSubjects: number;
  progress: TestProgress;
}): FocusTestOffer | null {
  const { paceMs, sitting } = progress;

  if (!askable || (sitting && sitting.answered > 0)) {
    return null;
  }

  const kind = sitting?.kind ?? (progress.answers > 0 ? "continuation" : "first");

  const questions =
    sitting?.questions ?? getSittingQuestions({ kind, paceMs, quickSubjects: openSubjects });

  if (questions === 0) {
    return null;
  }

  return {
    kind,
    minutes: getSittingMinutes({ paceMs, questions }),
    pastCeiling: Math.max(0, listUnasked(progress.subjects).length - questions),
    questions,
  };
}

function listUnasked(subjects: readonly SubjectProgress[]): SubjectProgress[] {
  return subjects.filter((subject) => subject.part === null && subject.asked === 0);
}

function getCounts(subjects: readonly SubjectProgress[]): FocusTestView["counts"] {
  return {
    asked: subjects.filter((subject) => subject.asked > 0).length,
    quick: subjects.filter((subject) => subject.part === null).length,
    total: subjects.length,
  };
}

export function toFocusTestSummary({
  dated,
  offer,
  progress,
  rows,
  settled,
}: {
  dated: boolean;
  offer: FocusTestOffer | null;
  progress: TestProgress;
  rows: readonly FocusRow[];
  settled: boolean;
}): FocusTestSummaryRecord {
  return {
    ...getCounts(progress.subjects),
    complete: settled,
    offerQuestions: offer?.questions ?? null,
    paceMs: progress.paceMs,
    suggested: dated
      ? rows.map((row) => ({
          areas: row.areas,
          name: row.subject.name,
          shortName: row.subject.shortName,
        }))
      : [],
    unasked: listUnasked(progress.subjects).length,
  };
}

export function toFocusTestView({
  asking,
  dated,
  lessonsSkipped,
  offer,
  plan,
  progress,
  rows,
  sessionQuestions,
}: {
  asking: AskingNow;
  dated: boolean;
  lessonsSkipped: number;
  offer: FocusTestOffer | null;
  plan: FocusPlan;
  progress: TestProgress;
  rows: FocusRow[];
  sessionQuestions: SessionQuestions;
}): FocusTestView {
  return {
    checkpoint:
      progress.answers > 0
        ? { focus: dated ? toFocus({ plan, rows }) : null, lessonsSkipped }
        : null,
    counts: getCounts(progress.subjects),
    dated,
    offer,
    sessionQuestions,
    sitting: toSitting({ asking, progress }),
    subjects: progress.subjects.map((subject) => toSubjectView(subject)),
  };
}

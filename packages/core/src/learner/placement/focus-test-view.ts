import { type PlanChangeView } from "../../plans/plan-view-contract";
import {
  type FocusRow,
  type FocusTestFocus,
  type FocusTestSitting,
  type FocusTestSubject,
  type FocusTestView,
  type SessionQuestions,
} from "./focus-test-contract";
import { type SubjectProgress, type TestProgress } from "./focus-test-progress";
import {
  type SittingKind,
  getSittingMinutes,
  getSittingQuestions,
  rankFocus,
} from "./focus-test-rules";
import { type FocusTestSummaryRecord } from "./focus-test-state";
import { isSameFocus, suggestsFocus } from "./focus-test-summary";
import { PRIOR_BELIEF, type SkillBeliefs } from "./placement-beliefs";

type NamedSubject = Pick<SubjectProgress, "areas" | "key" | "name" | "shortName">;

function toSubjectName(subject: NamedSubject) {
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

  return ranked.flatMap(({ key }) => {
    const subject = subjects.find((candidate) => candidate.key === key);
    return subject ? [toFocusRow(subject)] : [];
  });
}

function toFocusRow(subject: NamedSubject): FocusRow {
  return { areas: subject.areas, subject: toSubjectName(subject) };
}

/**
 * The subjects a waiting proposal gives more time, in its order. A proposal is a snapshot, so they
 * can differ from what the test would suggest now; an area no subject studies any more keeps its
 * own name, so the list still says what applying the proposal focuses.
 */
function listProposedRows({
  proposal,
  subjects,
}: {
  proposal: PlanChangeView;
  subjects: readonly NamedSubject[];
}): FocusRow[] {
  const areas = proposal.operations.flatMap((operation) =>
    operation.kind === "focusAreas" ? operation.areas : [],
  );

  const rows = areas.map((area) => {
    const subject = subjects.find((candidate) => candidate.areas.includes(area));

    return subject
      ? toFocusRow(subject)
      : { areas: [area], subject: { key: area, name: area, shortName: null } };
  });

  return rows.filter(
    (row, index) => rows.findIndex((other) => other.subject.key === row.subject.key) === index,
  );
}

export type FocusPlan = {
  declined: boolean;
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

  return plan.declined ? "declined" : "suggested";
}

export function toFocus({
  plan,
  rows,
  subjects,
}: {
  plan: FocusPlan;
  /** What the test suggests now. */
  rows: FocusRow[];
  subjects: readonly NamedSubject[];
}): FocusTestFocus | null {
  const state = getFocusState({ plan, suggested: rows.flatMap((row) => row.areas) });
  const proposal = state === "proposed" ? plan.proposal : null;
  const shown = proposal ? listProposedRows({ proposal, subjects }) : rows;

  return shown.length === 0 || state === null ? null : { proposal, rows: shown, state };
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

/**
 * The open sitting asks nothing more: its promised count was reached, every starting point is
 * set, or no question is ready for what's left, which the next sessions ask.
 */
export function isSittingOver({
  asking,
  progress,
}: {
  asking: AskingNow;
  progress: TestProgress;
}): boolean {
  const { sitting } = progress;

  if (!sitting) {
    return false;
  }

  return sitting.left <= 0 || asking.settled || !(asking.nextSubject !== null || asking.waiting);
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
    hint: sitting.manyUnknown ? "manyUnknown" : null,
    minutes: getSittingMinutes({ paceMs, questions: sitting.left }),
    questions: sitting.questions,
    subject: next ? toSubjectName(next) : null,
  };
}

/** A sitting as a start would open it; the API says only its `minutes`. */
export type SittingOffer = { kind: SittingKind; minutes: number; questions: number };

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
}): SittingOffer | null {
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

  return { kind, minutes: getSittingMinutes({ paceMs, questions }), questions };
}

function listUnasked(subjects: readonly SubjectProgress[]): SubjectProgress[] {
  return subjects.filter((subject) => subject.part === null && subject.asked === 0);
}

export function toFocusTestSummary({
  dated,
  inputsKey,
  offer,
  progress,
  rows,
  settled,
}: {
  dated: boolean;
  inputsKey: string;
  offer: SittingOffer | null;
  progress: TestProgress;
  rows: readonly FocusRow[];
  settled: boolean;
}): FocusTestSummaryRecord {
  const { subjects } = progress;

  return {
    asked: subjects.filter((subject) => subject.asked > 0).length,
    complete: settled,
    inputsKey,
    offerQuestions: offer?.questions ?? null,
    paceMs: progress.paceMs,
    quick: subjects.filter((subject) => subject.part === null).length,
    suggested: dated
      ? rows.map((row) => ({
          areas: row.areas,
          name: row.subject.name,
          shortName: row.subject.shortName,
        }))
      : [],
    total: subjects.length,
    unasked: listUnasked(subjects).length,
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
  offer: SittingOffer | null;
  plan: FocusPlan;
  progress: TestProgress;
  rows: FocusRow[];
  sessionQuestions: SessionQuestions;
}): FocusTestView {
  const { subjects } = progress;

  return {
    checkpoint:
      progress.answers > 0
        ? { focus: dated ? toFocus({ plan, rows, subjects }) : null, lessonsSkipped }
        : null,
    offer: offer && { minutes: offer.minutes },
    sessionQuestions,
    sitting: toSitting({ asking, progress }),
    subjects: subjects.map((subject) => toSubjectView(subject)),
    suggestsFocus: suggestsFocus({ dated, subjects: subjects.length }),
  };
}

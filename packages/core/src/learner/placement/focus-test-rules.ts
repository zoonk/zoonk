import {
  type FOCUS_REASONS,
  type SessionQuestions,
  type UncheckedPart,
} from "./focus-test-contract";
import { PLACEMENT_WEEK_DAYS } from "./placement-budget";

const MS_PER_MINUTE = 60_000;

/** What an answer takes before the learner has a pace of their own, in either quick format. */
const START_PACE_MS = MS_PER_MINUTE;

const SITTING_MINUTES = 15;

const MIN_PACE_ANSWERS = 5;

/** A break in the middle of a question isn't the learner's pace. */
export const MAX_PACED_ANSWER_MS = 3 * MS_PER_MINUTE;

const MIN_FIRST_QUESTIONS = 20;
const MAX_FIRST_QUESTIONS = 30;
const CONTINUATION_QUESTIONS = 10;

export const MAX_SUBJECT_QUESTIONS = 4;

const MAX_FOCUS_SUBJECTS = 3;

/** One subject in three at most, and one of two: a focus on most subjects is no focus. */
const SUBJECTS_PER_FOCUS = 3;

const MIN_FOCUS_CHOICES = 2;

export const UNKNOWN_STREAK = 5;

export type SittingKind = "continuation" | "first";

export function getPaceMs({
  answers,
  durationMs,
}: {
  answers: number;
  durationMs: number;
}): number {
  return answers < MIN_PACE_ANSWERS ? START_PACE_MS : Math.max(1, durationMs / answers);
}

/** The most questions a sitting promises: what fits about fifteen minutes at the learner's pace. */
export function getSittingQuestions({
  kind,
  paceMs,
  quickSubjects,
}: {
  kind: SittingKind;
  paceMs: number;
  quickSubjects: number;
}): number {
  const fit = Math.max(1, Math.floor((SITTING_MINUTES * MS_PER_MINUTE) / paceMs));
  const depth = MAX_SUBJECT_QUESTIONS * quickSubjects;

  const breadth =
    kind === "first"
      ? Math.min(MAX_FIRST_QUESTIONS, Math.max(MIN_FIRST_QUESTIONS, quickSubjects))
      : CONTINUATION_QUESTIONS;

  return Math.min(breadth, depth, fit);
}

export function getSittingMinutes({
  paceMs,
  questions,
}: {
  paceMs: number;
  questions: number;
}): number {
  return questions === 0 ? 0 : Math.max(1, Math.round((questions * paceMs) / MS_PER_MINUTE));
}

export function hasUnknownStreak(outcomes: readonly ("correct" | "dontKnow" | "wrong")[]): boolean {
  const streak = outcomes.length - 1 - outcomes.findLastIndex((outcome) => outcome !== "dontKnow");
  return streak >= UNKNOWN_STREAK;
}

export type FocusReason = (typeof FOCUS_REASONS)[number];

export type FocusCandidate = {
  /** Has a test answer. */
  asked: boolean;
  /** Mean belief over its topics, from real answers only: 0 to 1. */
  belief: number;
  key: string;
  minimumScore: boolean;
  /** One of its test answers was wrong or "I don't know yet". */
  missed: boolean;
  part: UncheckedPart | null;
  /** Its planning share of the exam. */
  share: number;
};

function getReason(candidate: FocusCandidate): FocusReason {
  if (candidate.missed) {
    return "answers";
  }

  if (candidate.minimumScore) {
    return "minimumScore";
  }

  if (candidate.part) {
    return "notChecked";
  }

  return candidate.asked ? "weight" : "notAsked";
}

/** Takes candidates in the notice's order and returns the most needed first. */
export function rankFocus(
  candidates: readonly FocusCandidate[],
): { key: string; reason: FocusReason }[] {
  if (candidates.length < MIN_FOCUS_CHOICES) {
    return [];
  }

  const count = Math.min(
    MAX_FOCUS_SUBJECTS,
    Math.max(1, Math.floor(candidates.length / SUBJECTS_PER_FOCUS)),
  );

  return candidates
    .map((candidate, index) => ({
      candidate,
      index,
      need: candidate.share * (1 - candidate.belief),
    }))
    .filter((entry) => entry.need > 0)
    .toSorted(
      (a, b) => b.need - a.need || b.candidate.share - a.candidate.share || a.index - b.index,
    )
    .slice(0, count)
    .map(({ candidate }) => ({ key: candidate.key, reason: getReason(candidate) }));
}

/** Sessions ask the test's questions through the first week, then only while a subject it can ask about has no answer. */
export function getSessionQuestions({
  complete,
  goalDay,
  paused,
  skippedToday,
  started,
  unaskedSubjects,
}: {
  /** Nothing useful is left to ask. */
  complete: boolean;
  /** Days since the goal was created, 0 on its first. */
  goalDay: number;
  paused: boolean;
  skippedToday: boolean;
  started: boolean;
  /** A subject the test can ask about has no answer yet. */
  unaskedSubjects: boolean;
}): SessionQuestions {
  if (!started || complete || !(goalDay < PLACEMENT_WEEK_DAYS || unaskedSubjects)) {
    return "off";
  }

  if (paused) {
    return "paused";
  }

  return skippedToday ? "skippedToday" : "on";
}

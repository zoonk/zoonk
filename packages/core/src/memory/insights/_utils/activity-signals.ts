import { type MistakeCause } from "@zoonk/db";
import { type MistakeSnapshot } from "../../../mistakes/mistake-snapshot";

/** A session part needs a few answers before its accuracy means anything. */
const MIN_SESSION_ANSWERS = 6;
const MIN_SESSIONS = 2;
const SESSION_PARTS = ["first third", "middle third", "last third"] as const;

const MIN_BUCKET_ANSWERS = 5;
const MIN_BUCKETS = 2;

/** Skills with enough answers and fewer than this share right are worth a closer look. */
const MIN_SKILL_ANSWERS = 4;
const WEAK_SKILL_ACCURACY = 0.7;
const MAX_WEAK_SKILLS = 3;
const MAX_MISTAKE_EXAMPLES = 3;

const PERCENT = 100;
const SECONDS_PER_MINUTE = 60;

/** Learner-local hours, labeled the way a person would say them. */
const TIME_BUCKETS = [
  { from: 0, label: "00:00-06:00", to: 6 },
  { from: 6, label: "06:00-12:00", to: 12 },
  { from: 12, label: "12:00-18:00", to: 18 },
  { from: 18, label: "18:00-21:00", to: 21 },
  { from: 21, label: "21:00-24:00", to: 24 },
] as const;

const CAUSE_LABELS: Record<MistakeCause, string> = {
  gap: "content gap",
  guess: "guessed",
  misread: "misread the question",
  time: "ran out of time",
  trap: "fell for a trap",
};

type ActivityAttempt = {
  answeredAt: Date;
  hour: number;
  isCorrect: boolean;
  localDate: Date;
  skillId: string | null;
  studySessionId: string | null;
};

type ActivityMistake = {
  cause: MistakeCause | null;
  skillId: string | null;
  snapshot: MistakeSnapshot;
};

export type ActivitySkill = { id: string; name: string };

export type RecentActivity = {
  attempts: readonly ActivityAttempt[];
  mistakes: readonly ActivityMistake[];
  skills: readonly ActivitySkill[];
  /** Seconds studied per learner-local day, from the activity ledger. */
  studyDays: readonly { localDate: Date; seconds: number }[];
  /** The goal's planned minutes a day. */
  dailyMinutes: number | null;
  windowDays: number;
};

export type ActivitySignals = {
  answerCount: number;
  dayCount: number;
  /** What the insight and session-memory models read: numbers code measured, one line each. */
  text: string;
  /** Weakest skills first, the ones a plan change may add a lesson for. */
  weakSkills: ActivitySkill[];
};

type Tally = { correct: number; days: Set<number>; total: number };

function tally(attempts: readonly ActivityAttempt[]): Tally {
  return {
    correct: attempts.filter((attempt) => attempt.isCorrect).length,
    days: new Set(attempts.map((attempt) => attempt.localDate.getTime())),
    total: attempts.length,
  };
}

/** Model input, not learner copy, but "1 days" still reads as a counting mistake. */
function countDays(days: number): string {
  return days === 1 ? "1 day" : `${days} days`;
}

function percentRight({ correct, total }: Tally): number {
  return total === 0 ? 0 : Math.round((correct / total) * PERCENT);
}

function describeTotals(activity: RecentActivity): string {
  const totals = tally(activity.attempts);

  return `Answers in the last ${activity.windowDays} days: ${totals.total} on ${countDays(totals.days.size)}, ${percentRight(totals)}% right.`;
}

/** The part of a session an answer fell in, from its position among that session's answers. */
function getSessionPart({ index, length }: { index: number; length: number }): number {
  return Math.min(SESSION_PARTS.length - 1, Math.floor((index / length) * SESSION_PARTS.length));
}

function describeSessionParts(attempts: readonly ActivityAttempt[]): string | null {
  const inSessions = attempts.filter((attempt) => attempt.studySessionId !== null);

  const sessions = [
    ...Map.groupBy(inSessions, (attempt) => attempt.studySessionId).values(),
  ].filter((session) => session.length >= MIN_SESSION_ANSWERS);

  if (sessions.length < MIN_SESSIONS) {
    return null;
  }

  const byPart = sessions.flatMap((session) =>
    session
      .toSorted((first, second) => first.answeredAt.getTime() - second.answeredAt.getTime())
      .map((attempt, index) => ({
        attempt,
        part: getSessionPart({ index, length: session.length }),
      })),
  );

  const parts = SESSION_PARTS.map((label, part) => {
    const partTally = tally(
      byPart.filter((entry) => entry.part === part).map((entry) => entry.attempt),
    );

    return `${label} ${percentRight(partTally)}% right (${partTally.total} answers)`;
  });

  return `By part of the session, over ${sessions.length} sessions: ${parts.join(", ")}.`;
}

function describeTimeOfDay(attempts: readonly ActivityAttempt[]): string | null {
  const buckets = TIME_BUCKETS.map((bucket) => ({
    label: bucket.label,
    tally: tally(
      attempts.filter((attempt) => attempt.hour >= bucket.from && attempt.hour < bucket.to),
    ),
  })).filter((bucket) => bucket.tally.total >= MIN_BUCKET_ANSWERS);

  if (buckets.length < MIN_BUCKETS) {
    return null;
  }

  const parts = buckets.map(
    ({ label, tally: bucket }) =>
      `${label} ${percentRight(bucket)}% right (${bucket.total} answers on ${countDays(bucket.days.size)})`,
  );

  return `By time of day: ${parts.join("; ")}.`;
}

function describeCauses(mistakes: readonly ActivityMistake[]): string {
  const causes = Object.entries(CAUSE_LABELS).flatMap(([cause, label]) => {
    const count = mistakes.filter((mistake) => mistake.cause === cause).length;
    return count > 0 ? [`${count} ${label}`] : [];
  });

  return causes.length > 0 ? ` (${causes.join(", ")})` : "";
}

function findWeakSkills(activity: RecentActivity) {
  const bySkill = Map.groupBy(activity.attempts, (attempt) => attempt.skillId);

  return activity.skills
    .flatMap((skill) => {
      const skillTally = tally(bySkill.get(skill.id) ?? []);
      const accuracy = skillTally.total === 0 ? 1 : skillTally.correct / skillTally.total;
      const mistakes = activity.mistakes.filter((mistake) => mistake.skillId === skill.id);

      return skillTally.total >= MIN_SKILL_ANSWERS && accuracy < WEAK_SKILL_ACCURACY
        ? [{ accuracy, mistakes, skill, tally: skillTally }]
        : [];
    })
    .toSorted(
      (first, second) =>
        first.accuracy - second.accuracy || second.mistakes.length - first.mistakes.length,
    )
    .slice(0, MAX_WEAK_SKILLS);
}

function describeMistake({ snapshot }: ActivityMistake): string {
  const answered = snapshot.answer ? `answered "${snapshot.answer}"` : "no answer";
  const right = snapshot.correctAnswer ? `, right answer "${snapshot.correctAnswer}"` : "";
  const misconception = snapshot.misconception ? ` (${snapshot.misconception})` : "";

  return `- "${snapshot.question}": ${answered}${right}${misconception}`;
}

function describeWeakSkills(weak: ReturnType<typeof findWeakSkills>): string[] {
  const [weakest] = weak;

  if (!weakest) {
    return [];
  }

  const skills = weak.map(
    ({ mistakes, skill, tally: skillTally }) =>
      `- ${skill.name}: ${skillTally.correct} of ${skillTally.total} right, ${mistakes.length} mistakes${describeCauses(mistakes)}`,
  );

  const examples = weakest.mistakes
    .slice(0, MAX_MISTAKE_EXAMPLES)
    .map((mistake) => describeMistake(mistake));

  return [
    "Skills with the most trouble:",
    ...skills,
    ...(examples.length > 0 ? [`Recent mistakes on ${weakest.skill.name}:`, ...examples] : []),
  ];
}

function describeStudyTime(activity: RecentActivity): string | null {
  const studied = activity.studyDays.filter((day) => day.seconds > 0);

  if (studied.length === 0) {
    return null;
  }

  const seconds = studied.reduce((total, day) => total + day.seconds, 0);
  const minutes = Math.round(seconds / studied.length / SECONDS_PER_MINUTE);
  const plan = activity.dailyMinutes ? `; the plan asks for ${activity.dailyMinutes}` : "";

  return `Studied on ${studied.length} of the last ${activity.windowDays} days, ${minutes} minutes a day on average${plan}.`;
}

/**
 * Turns recent answers, mistakes and study time into short lines of numbers a model can read
 * without computing anything: accuracy overall, by part of the session, by time of day and on the
 * weakest skills, with examples of recent mistakes. Lines without enough answers behind them are
 * left out, so a pattern is never read into a handful of answers.
 */
export function buildActivitySignals(activity: RecentActivity): ActivitySignals {
  const totals = tally(activity.attempts);
  const weak = findWeakSkills(activity);

  const lines = [
    describeTotals(activity),
    describeSessionParts(activity.attempts),
    describeTimeOfDay(activity.attempts),
    ...describeWeakSkills(weak),
    describeStudyTime(activity),
  ].filter((line): line is string => Boolean(line));

  return {
    answerCount: totals.total,
    dayCount: totals.days.size,
    text: lines.join("\n"),
    weakSkills: weak.map(({ skill }) => skill),
  };
}

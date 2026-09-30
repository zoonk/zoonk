import { type MistakeCause } from "@zoonk/db";

/** The practice each cause gets. A mistake whose cause isn't known yet is simply retried. */
export const MISTAKE_DRILL_KINDS = [
  "noGuessing",
  "readCarefully",
  "reteach",
  "retry",
  "spotTheTrap",
  "timed",
] as const;

export type MistakeDrillKind = (typeof MISTAKE_DRILL_KINDS)[number];

/** A question on the mistake's skill the drill could use. */
export type DrillItemCandidate = { hasMisconceptions: boolean; id: string; seen: boolean };

export type MistakeDrill = {
  itemIds: string[];
  kind: MistakeDrillKind;
  /** The lesson that teaches the skill, for a content gap: the idea comes back before questions. */
  lessonId: string | null;
  /** A per-question time box, only for mistakes made by running out of time. */
  timeLimitSeconds: number | null;
};

const DRILL_KINDS: Readonly<Record<MistakeCause, MistakeDrillKind>> = {
  gap: "reteach",
  guess: "noGuessing",
  misread: "readCarefully",
  time: "timed",
  trap: "spotTheTrap",
};

/** New questions a drill adds after retrying the original one. */
const EXTRA_QUESTIONS: Readonly<Record<MistakeDrillKind, number>> = {
  noGuessing: 1,
  readCarefully: 1,
  reteach: 2,
  retry: 1,
  spotTheTrap: 2,
  timed: 2,
};

const TIMED_DRILL_SECONDS = 45;

const MS_PER_SECOND = 1000;

/** The drill a mistake's cause calls for. */
export function getDrillKind(cause: MistakeCause | null): MistakeDrillKind {
  return cause ? DRILL_KINDS[cause] : "retry";
}

/** A per-question time box, only for the drill of a mistake made by running out of time. */
export function getDrillTimeLimitSeconds(kind: MistakeDrillKind): number | null {
  return kind === "timed" ? TIMED_DRILL_SECONDS : null;
}

/**
 * Whether an answer took its drill's whole time box, which counts as wrong, as on the day. Apps
 * send "I don't know" as time runs out, so this only catches an answer that came too late.
 */
export function isPastTimeLimit({
  durationMs,
  timeLimitSeconds,
}: {
  durationMs: number;
  timeLimitSeconds: number | null;
}): boolean {
  return timeLimitSeconds !== null && durationMs >= timeLimitSeconds * MS_PER_SECOND;
}

function rankCandidate({
  candidate,
  kind,
}: {
  candidate: DrillItemCandidate;
  kind: MistakeDrillKind;
}): number {
  const seenRank = candidate.seen ? 1 : 0;
  const trapRank = kind === "spotTheTrap" && !candidate.hasMisconceptions ? 2 : 0;

  return seenRank + trapRank;
}

/**
 * Builds the targeted drill for one mistake: the same question again, then a few more on the skill
 * chosen by cause. Unseen questions come first, and a trap drill prefers questions whose wrong
 * options carry misconceptions, so the learner practices spotting them.
 */
export function selectMistakeDrill({
  candidates,
  cause,
  lessonId,
  originalItemId,
}: {
  candidates: readonly DrillItemCandidate[];
  cause: MistakeCause | null;
  lessonId: string | null;
  originalItemId: string | null;
}): MistakeDrill {
  const kind = getDrillKind(cause);
  const original = candidates.find((candidate) => candidate.id === originalItemId);

  const extras = candidates
    .filter((candidate) => candidate.id !== originalItemId)
    .toSorted(
      (a, b) => rankCandidate({ candidate: a, kind }) - rankCandidate({ candidate: b, kind }),
    )
    .slice(0, EXTRA_QUESTIONS[kind]);

  return {
    itemIds: [original, ...extras]
      .filter((candidate) => candidate !== undefined)
      .map(({ id }) => id),
    kind,
    lessonId: kind === "reteach" ? lessonId : null,
    timeLimitSeconds: getDrillTimeLimitSeconds(kind),
  };
}

/** An open notebook entry as practice sees it. */
export type PracticeCandidate = { createdLocalDate: Date; id: string; skillId: string | null };

/**
 * Picks the mistakes for "Practice mistakes": oldest first, one per skill before a second from the
 * same skill, and none made today, since fixing a mistake means getting it right on a later day.
 */
export function selectMistakesToPractice<TMistake extends PracticeCandidate>({
  limit,
  mistakes,
  today,
}: {
  limit: number;
  mistakes: readonly TMistake[];
  /** The learner-local date, as a UTC-midnight label. */
  today: Date;
}): TMistake[] {
  const eligible = mistakes
    .filter((mistake) => mistake.createdLocalDate.getTime() < today.getTime())
    .toSorted((a, b) => a.createdLocalDate.getTime() - b.createdLocalDate.getTime());

  const firstPerSkill = eligible.filter(
    (mistake, index) =>
      mistake.skillId === null ||
      eligible.findIndex((other) => other.skillId === mistake.skillId) === index,
  );

  const rest = eligible.filter((mistake) => !firstPerSkill.includes(mistake));

  return [...firstPerSkill, ...rest].slice(0, limit);
}

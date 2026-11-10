import { type MistakeCause } from "@zoonk/db";

export const MISTAKE_DRILL_KINDS = [
  "noGuessing",
  "readCarefully",
  "reteach",
  "retry",
  "spotTheTrap",
  "timed",
] as const;

export type MistakeDrillKind = (typeof MISTAKE_DRILL_KINDS)[number];

export type DrillLesson = { id: string; ideas: string[]; title: string };

export type DrillView = {
  kind: MistakeDrillKind;
  lesson: DrillLesson | null;
  timeLimitSeconds: number | null;
};

export type MistakeDrill = {
  itemIds: string[];
  kind: MistakeDrillKind;
  lessonId: string | null;
  timeLimitSeconds: number | null;
};

const DRILL_KINDS: Readonly<Record<MistakeCause, MistakeDrillKind>> = {
  gap: "reteach",
  guess: "noGuessing",
  misread: "readCarefully",
  time: "timed",
  trap: "spotTheTrap",
};

const TIMED_DRILL_SECONDS = 45;

const MS_PER_SECOND = 1000;

export function getDrillKind(cause: MistakeCause | null): MistakeDrillKind {
  return cause ? DRILL_KINDS[cause] : "retry";
}

/** Per question; null for untimed drills. */
export function getDrillTimeLimitSeconds(kind: MistakeDrillKind): number | null {
  return kind === "timed" ? TIMED_DRILL_SECONDS : null;
}

/** The exact deadline is already late, not only durations exceeding it. */
export function isPastTimeLimit({
  durationMs,
  timeLimitSeconds,
}: {
  durationMs: number;
  timeLimitSeconds: number | null;
}): boolean {
  return timeLimitSeconds !== null && durationMs >= timeLimitSeconds * MS_PER_SECOND;
}

export type PracticeCandidate = { createdLocalDate: Date; id: string; skillId: string | null };

/** Oldest first with one-per-skill breadth; excludes mistakes from the learner's current local day. */
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

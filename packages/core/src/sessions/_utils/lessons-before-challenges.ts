import { type PlanItem } from "@zoonk/db";
import { type BlockCheckpoint } from "../block-payload";

type DayItem = Pick<PlanItem, "position" | "scheduledFor">;

/** A challenge of the day, as the session has it. */
type DayChallenge = Pick<BlockCheckpoint, "kind" | "rematch"> & { planItemId: string | null };

/** Where the plan has a lesson of the day around its first duel (see `getChallengeSide`). */
export type DuelMarks = {
  /**
   * The plan has it before a challenge the day asks (a phase's last lessons can share its
   * challenge's day): it comes first even on a first duel's day (see `keepDuelLessons`).
   */
  beforeChallenge?: boolean;
  /**
   * The plan has it after the day's first duel, due by today (the challenge leads its day, and the
   * next lessons follow it there): it comes after the challenge (see `keepDuelLessons`).
   */
  afterChallenge?: boolean;
};

/** A lesson of the day, as the session has it. */
type DayLesson = DuelMarks & { planItemId: string | null };

/** A phase's challenge the learner hasn't played yet: not a rematch, not the week's. */
function isFirstDuel(checkpoint: Pick<DayChallenge, "kind" | "rematch">): boolean {
  return checkpoint.kind !== "weekly" && !checkpoint.rematch;
}

/**
 * Where a lesson of a first duel's day stands to the day's last first duel (`challengeAt`, its
 * position in the plan): before it, or after it and due by today (the challenge leads the day the
 * plan gives it, and the next lessons follow it there); null for a later day's, which waits.
 */
function getChallengeSide({
  challengeAt,
  item,
  today,
}: {
  challengeAt: number;
  item: DayItem;
  today: Date;
}): "after" | "before" | null {
  if (item.position < challengeAt) {
    return "before";
  }

  return item.scheduledFor !== null && item.scheduledFor <= today ? "after" : null;
}

/**
 * The day's lessons, marked by where the plan has them around the day's last first duel (see
 * `getChallengeSide`): `beforeChallenge`, a phase's last lessons sharing its challenge's day, which
 * come first (held back as new lessons, they came after the challenge that tests them), and
 * `afterChallenge`, the ones the plan gives the challenge's day after it (held back, the chapter's
 * next lesson a learner was promised for that day left Today with the challenge alone). The plan's
 * saved items say where, never the chapter the learner is in now.
 */
export function markLessonsAroundChallenges<TLesson extends DayLesson>({
  checkpoints,
  items,
  lessons,
  today,
}: {
  checkpoints: readonly DayChallenge[];
  items: readonly (DayItem & Pick<PlanItem, "id">)[];
  lessons: readonly TLesson[];
  today: Date;
}): (TLesson & DuelMarks)[] {
  const byId = new Map(items.map((item) => [item.id, item]));

  const challengeAt = Math.max(
    -1,
    ...checkpoints.flatMap((checkpoint) =>
      isFirstDuel(checkpoint) && checkpoint.planItemId
        ? [byId.get(checkpoint.planItemId)?.position ?? -1]
        : [],
    ),
  );

  if (challengeAt === -1) {
    return [...lessons];
  }

  return lessons.map((lesson) => {
    const item = lesson.planItemId ? byId.get(lesson.planItemId) : undefined;
    const side = item && getChallengeSide({ challengeAt, item, today });

    if (side === "before") {
      return { ...lesson, beforeChallenge: true };
    }

    return side === "after" ? { ...lesson, afterChallenge: true } : lesson;
  });
}

/**
 * The new lessons a day takes. On a first duel's day, practice prepares for the challenge, so new
 * lessons wait, but the ones the plan has before it come first all the same (a challenge comes
 * after the lessons it tests, R40), and the ones it has after it on this day follow it (see
 * `markLessonsAroundChallenges`): only later days' wait. A rematch never holds them back: losing
 * a boss never locks the next phase.
 */
export function keepDuelLessons<TLesson extends DayLesson>({
  checkpoints,
  lessons,
}: {
  checkpoints: readonly Pick<DayChallenge, "kind" | "rematch">[];
  lessons: readonly TLesson[];
}): readonly TLesson[] {
  return checkpoints.some((checkpoint) => isFirstDuel(checkpoint))
    ? lessons.filter((lesson) => lesson.beforeChallenge || lesson.afterChallenge)
    : lessons;
}

/** The day's lessons, in plan order, before the day's first duel and after it (`afterChallenge`). */
export function splitAtDuel<TLesson extends DuelMarks>(
  lessons: readonly TLesson[],
): { after: TLesson[]; before: TLesson[] } {
  return {
    after: lessons.filter((lesson) => lesson.afterChallenge),
    before: lessons.filter((lesson) => !lesson.afterChallenge),
  };
}

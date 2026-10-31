import { type PlanItem } from "@zoonk/db";
import { type BlockCheckpoint } from "../block-payload";

type DayItem = Pick<PlanItem, "position" | "scheduledFor">;

type DayChallenge = Pick<BlockCheckpoint, "kind" | "rematch"> & {
  planItemId: string | null;
  planItemKey?: string | null;
};

export type DuelMarks = {
  /** Lessons the challenge tests must precede it even when sharing its scheduled day. */
  beforeChallenge?: boolean;
  /** Preserve lessons promised after the duel on its own day; later days still wait. */
  afterChallenge?: boolean;
};

type DayLesson = DuelMarks & { planItemId: string | null; planItemKey?: string | null };

function isFirstDuel(checkpoint: Pick<DayChallenge, "kind" | "rematch">): boolean {
  return checkpoint.kind !== "weekly" && !checkpoint.rematch;
}

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

/** Use saved plan order, never the learner's currently open chapter, to place lessons around duels. */
export function markLessonsAroundChallenges<TLesson extends DayLesson>({
  checkpoints,
  items,
  lessons,
  today,
}: {
  checkpoints: readonly DayChallenge[];
  items: readonly (DayItem & { id: string | null; key?: string })[];
  lessons: readonly TLesson[];
  today: Date;
}): (TLesson & DuelMarks)[] {
  const byId = new Map(items.map((item) => [item.id ?? item.key, item]));

  const challengeAt = Math.max(
    -1,
    ...checkpoints.flatMap((checkpoint) =>
      isFirstDuel(checkpoint) && (checkpoint.planItemId ?? checkpoint.planItemKey)
        ? [byId.get(checkpoint.planItemId ?? checkpoint.planItemKey ?? undefined)?.position ?? -1]
        : [],
    ),
  );

  if (challengeAt === -1) {
    return [...lessons];
  }

  return lessons.map((lesson) => {
    const identity = lesson.planItemId ?? lesson.planItemKey;
    const item = identity ? byId.get(identity) : undefined;
    const side = item && getChallengeSide({ challengeAt, item, today });

    if (side === "before") {
      return { ...lesson, beforeChallenge: true };
    }

    return side === "after" ? { ...lesson, afterChallenge: true } : lesson;
  });
}

/** Rematches never lock the next phase; first duels preserve lessons promised before/after them on the same day. */
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

/** Preserves plan order within each side of the duel. */
export function splitAtDuel<TLesson extends DuelMarks>(
  lessons: readonly TLesson[],
): { after: TLesson[]; before: TLesson[] } {
  return {
    after: lessons.filter((lesson) => lesson.afterChallenge),
    before: lessons.filter((lesson) => !lesson.afterChallenge),
  };
}

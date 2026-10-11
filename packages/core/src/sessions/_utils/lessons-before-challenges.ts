import { type PlanItem } from "@zoonk/db";
import { type PlannedCheckpoint, type PlannedLesson } from "../session-builder";

/**
 * The day's lessons, each the plan has before a challenge the session duels marked
 * (`beforeChallenge`): a phase's last lessons can share its challenge's day, and they come first.
 * Held back as new lessons on a first duel's day, they came after the challenge that tests them.
 */
export function markLessonsBeforeChallenges({
  checkpoints,
  items,
  lessons,
}: {
  checkpoints: readonly PlannedCheckpoint[];
  items: readonly Pick<PlanItem, "id" | "position">[];
  lessons: readonly PlannedLesson[];
}): PlannedLesson[] {
  const positions = new Map(items.map((item) => [item.id, item.position]));

  const last = Math.max(
    -1,
    ...checkpoints.flatMap((checkpoint) =>
      checkpoint.kind !== "weekly" && !checkpoint.rematch && checkpoint.planItemId
        ? [positions.get(checkpoint.planItemId) ?? -1]
        : [],
    ),
  );

  return lessons.map((lesson) => {
    const position = lesson.planItemId ? positions.get(lesson.planItemId) : undefined;

    return position !== undefined && position < last
      ? { ...lesson, beforeChallenge: true }
      : lesson;
  });
}

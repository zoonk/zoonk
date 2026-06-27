import { type PlayerCompletionMilestone } from "./completion-milestones";

export type PlayerCompletionMilestoneKey = string;

/**
 * Milestone keys let the client remember which milestone screens already
 * appeared in this browser session. That covers prefetched lesson pages whose
 * server snapshot can be older than the just-completed lesson.
 */
export function getCompletionMilestoneKey({
  localDate,
  milestone,
}: {
  localDate: string;
  milestone: PlayerCompletionMilestone;
}): PlayerCompletionMilestoneKey {
  if (milestone.kind === "energy" && milestone.status === "threshold") {
    return `energy:threshold:${milestone.energy}`;
  }

  if (milestone.kind === "energy") {
    return `energy:full-days:${milestone.days}`;
  }

  if (milestone.kind === "brainPower") {
    return `brain-power:daily-record:${localDate}`;
  }

  if (milestone.kind === "learningDays") {
    return `learning-days:${milestone.days}`;
  }

  if (milestone.kind === "learningTime") {
    return `learning-time:${milestone.seconds}`;
  }

  if (milestone.kind === "score") {
    return `score:best-day:${localDate}`;
  }

  if (milestone.status === "achieved") {
    return `level:achieved:${milestone.belt.color}:${milestone.belt.level}`;
  }

  return `level:halfway:${milestone.targetBelt.color}:${milestone.targetBelt.level}`;
}

/**
 * Filters milestones that were already shown from a previous lesson in the same
 * tab. Server progress remains the source of truth; this only closes the gap
 * where client navigation can reuse a stale prefetched snapshot.
 */
export function getUnseenMilestones({
  localDate,
  milestones,
  shownMilestoneKeys,
}: {
  localDate: string;
  milestones: PlayerCompletionMilestone[];
  shownMilestoneKeys: readonly PlayerCompletionMilestoneKey[];
}) {
  const shownKeys = new Set(shownMilestoneKeys);

  return milestones.filter(
    (milestone) => !shownKeys.has(getCompletionMilestoneKey({ localDate, milestone })),
  );
}

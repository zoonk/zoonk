import "server-only";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getMemoryCacheTag } from "../cache/tags";
import { type FollowUp } from "../follow-ups/follow-up-contract";
import { findActiveGoalId } from "../goals/_utils/goal-view";
import { isMemoryEnabled } from "./_utils/memory-access";
import { hasEnoughActivity, loadGoalActivity } from "./insights/_utils/goal-activity";
import { type MemoryChange } from "./memory-contract";
import { saveMemoryCandidate } from "./remember-candidate";
import { type ProposedMemoryUpdate, proposeMemoryUpdate } from "./update-memory-from-activity";

type SessionEnd = { endedAt: string; goalId: string; sessionId: string; timeZone: string };

/**
 * Memory reads a session once, at its first stop or end, as of that moment. A session without a
 * goal is read for the learner's active goal.
 */
export async function getSessionMemoryFollowUps({
  endedAt,
  goalId,
  sessionId,
  timeZone,
  userId,
}: {
  endedAt: Date;
  goalId: string | null;
  sessionId: string;
  timeZone: string;
  userId: string;
}): Promise<FollowUp[]> {
  const readGoalId = goalId ?? (await findActiveGoalId(userId));

  if (!readGoalId) {
    return [];
  }

  const date = getDateInTimeZone({ date: endedAt, timeZone }).toISOString().slice(0, 10);
  const end = { endedAt: endedAt.toISOString(), goalId: readGoalId, timeZone };

  return [
    { input: { ...end, sessionId }, kind: "rememberSession" },
    { input: { ...end, date }, kind: "checkDailyInsight" },
  ];
}

/** Internal, for the follow-up a session's end owes. */
export async function proposeSessionMemory({
  endedAt,
  goalId,
  sessionId,
  timeZone,
  userId,
}: SessionEnd & { userId: string }): Promise<ProposedMemoryUpdate | null> {
  if (!(await isMemoryEnabled(userId))) {
    return null;
  }

  const activity = await loadGoalActivity({ goalId, now: new Date(endedAt), timeZone, userId });

  if (!activity || !hasEnoughActivity(activity.signals)) {
    return null;
  }

  return proposeMemoryUpdate({
    goalId: activity.goal.id,
    source: {
      activity: activity.signals.text,
      id: sessionId,
      kind: "session",
      language: activity.goal.language,
    },
    timeZone: activity.timeZone,
    userId,
  });
}

/** Internal, for the follow-up the schedule answer owes once onboarding has every answer. */
export function proposeOnboardingMemory({
  goalId,
  userId,
}: {
  goalId: string;
  userId: string;
}): Promise<ProposedMemoryUpdate | null> {
  return proposeMemoryUpdate({ goalId, source: { goalId, kind: "onboarding" }, userId });
}

/** Internal: saves one gated candidate; candidates run in order, each seeing the previous one. */
export async function rememberMemoryCandidate(
  input: Parameters<typeof saveMemoryCandidate>[0],
): Promise<MemoryChange | null> {
  const change = await saveMemoryCandidate(input);

  if (change) {
    revalidateCacheTags([getMemoryCacheTag(input.context.userId)]);
  }

  return change;
}

import "server-only";
import { findOwnedGoal } from "../../learner/_utils/owned-goal";
import { getPracticeTimeZone } from "../mistake-availability";
import { findPracticeBlock } from "./practice-block";

export async function getPracticeAnswerScope({
  blockId,
  goalId,
  mistakeId,
  timeZone,
  userId,
}: {
  blockId?: string;
  goalId?: string;
  mistakeId: string;
  timeZone?: string;
  userId: string;
}) {
  const block = blockId ? await findPracticeBlock({ blockId, userId }) : null;

  if (
    blockId &&
    (!block ||
      !block.mistakeIds.includes(mistakeId) ||
      (goalId !== undefined && block.session.goalId !== goalId))
  ) {
    return null;
  }

  const owned = !block && goalId ? await findOwnedGoal(goalId) : null;
  const goal = block?.session.goal ?? (owned?.status === "ready" ? owned.goal : null);

  return {
    goalId: block ? (goal?.id ?? undefined) : goalId,
    timeZone: await getPracticeTimeZone({ goal, timeZone, userId }),
  };
}

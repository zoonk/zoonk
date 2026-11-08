import { type GoalRebuildFollowUp } from "@zoonk/core/goals/rebuild-follow-up";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";

const PREFIX = "goal-rebuild";

const ask = z.tuple([
  z.literal(PREFIX),
  uuidSchema(),
  uuidSchema(),
  z.coerce.number().int().nonnegative(),
]);

export function getGoalRebuildAsk({
  followUp,
  goalId,
}: {
  followUp: GoalRebuildFollowUp;
  goalId: string;
}): string {
  return `${PREFIX}:${goalId}:${followUp.id}:${followUp.revision}`;
}

export function readGoalRebuildAsk(token: string) {
  const parsed = ask.safeParse(token.split(":"));

  if (!parsed.success) {
    return null;
  }

  const [, goalId, id, revision] = parsed.data;
  return { followUp: { id, revision }, goalId };
}

import { type TodayLearnBlock } from "../../plans/_utils/up-next-item";
import { readBlockPayload } from "../../sessions/block-payload";
import { getAnswerTimeZone } from "../_utils/owned-goal";
import { readOwnedGoal } from "./owned-goal";
import { readTodayPlanSession } from "./today-plan-session";

export async function readTodayLearnBlocks(
  userId: string,
  goalId: string,
): Promise<TodayLearnBlock[]> {
  const goal = await readOwnedGoal(userId, goalId);
  const session = await readTodayPlanSession(userId, goalId, getAnswerTimeZone({ goal }));
  return listTodayLearnBlocks(session?.blocks ?? []);
}

export function listTodayLearnBlocks(
  blocksInDay: NonNullable<Awaited<ReturnType<typeof readTodayPlanSession>>>["blocks"],
): TodayLearnBlock[] {
  const blocks = blocksInDay.filter(
    (block) => block.kind === "learn" && (block.status === "active" || block.status === "pending"),
  );

  return [
    ...blocks.filter((block) => block.status === "active"),
    ...blocks.filter((block) => block.status === "pending"),
  ].map((block) => ({ lessonId: block.lessonId, planItemId: readBlockPayload(block).planItemId }));
}

import "server-only";
import { toIdKey } from "../../library/_utils/shared-rows";
import { parsePlanGraph } from "../../plans/planner/plan-state";
import { readClaimEvents } from "../facts/claim-events";
import { type SavedPlan } from "../facts/saved-plan";
import { type ClaimEvent } from "./skill-claims";

/**
 * GET-only, after ownership authorization; writes call `loadClaimEvents` fresh. Every reader shares
 * one read of the plan's skills (plus any others it asks about), however few it needs.
 */
export async function readGoalClaimEvents({
  goalId,
  savedPlan,
  skillIds,
  userId,
}: {
  goalId: string;
  savedPlan: Pick<SavedPlan, "graph"> | null;
  skillIds: readonly string[];
  userId: string;
}): Promise<ClaimEvent[]> {
  const planSkillIds = parsePlanGraph(savedPlan?.graph).skills.map((skill) => skill.skillId);
  const events = await readClaimEvents(userId, goalId, toIdKey([...planSkillIds, ...skillIds]));
  const wanted = new Set(skillIds);

  return events.filter((event) => wanted.has(event.skillId));
}

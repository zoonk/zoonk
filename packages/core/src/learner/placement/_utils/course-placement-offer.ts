import "server-only";
import { type Goal, type TransactionClient } from "@zoonk/db";
import { loadCoursePlacementPlan } from "../../_utils/goal-skill-graph";
import { readCourseBank } from "./course-placement-bank";
import { getCourseOffer, getTopicsAhead } from "./placement-attempt-record";

export async function loadCoursePlacementTopics(goalId: string, tx?: TransactionClient) {
  return getTopicsAhead(await loadCoursePlacementPlan(goalId, { tx }));
}

export async function readCoursePlacementOffer(
  goal: Pick<Goal, "details" | "id" | "userId" | "examBlueprintId">,
) {
  const bank = await readCourseBank(goal);
  return { offer: bank.possible ? getCourseOffer(bank.topics.length) : null, ready: bank.ready };
}

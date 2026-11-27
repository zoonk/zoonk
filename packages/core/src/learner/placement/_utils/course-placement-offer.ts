import "server-only";
import { type Goal, type TransactionClient, prisma } from "@zoonk/db";
import { readDatabaseFacts } from "../../../_utils/read-database-facts";
import { loadPlacementPlan } from "../../_utils/goal-skill-graph";
import { isQuickChoice } from "../../_utils/placement-guess-rate";
import { loadWritingSkillIds } from "../../writing-skills";
import { pickPlacementItem } from "../placement-item-choice";
import { getCourseOffer, getTopicsAhead } from "./placement-attempt-record";
import { loadPlacementItems } from "./placement-bank-items";
import { loadSeenPlacementItems } from "./placement-evidence";
import { loadQuestion } from "./placement-state-view";

export async function loadCoursePlacementTopics(goalId: string, tx: TransactionClient = prisma) {
  const [plan, writing] = await readDatabaseFacts(
    tx,
    () => loadPlacementPlan(goalId, tx),
    () => loadWritingSkillIds(goalId, tx),
  );

  return getTopicsAhead(plan).filter((skill) => !writing.has(skill.id));
}

export async function readCoursePlacementOffer({
  goal,
  checkReadiness = false,
}: {
  goal: Pick<Goal, "id" | "userId" | "examBlueprintId">;
  checkReadiness?: boolean;
}) {
  const topics = await loadCoursePlacementTopics(goal.id);
  const offer = getCourseOffer(topics.length);
  const first = topics[0];

  if (!checkReadiness || !first) {
    return { offer, ready: false };
  }

  const items = await loadPlacementItems({
    examBlueprintId: goal.examBlueprintId,
    skillIds: [first.id],
  });

  const quick = items.filter((item) => isQuickChoice(item));

  const seen = await loadSeenPlacementItems({
    itemIds: quick.map((item) => item.id),
    userId: goal.userId,
  });

  const firstItem = pickPlacementItem({
    confirming: false,
    items: quick.map((item) => ({ ...item, seen: seen.has(item.id) })),
    skillId: first.id,
  });

  const next = await loadQuestion(firstItem?.id);
  return { offer, ready: next !== null };
}

import "server-only";
import { randomUUID } from "node:crypto";
import { type Goal, type TransactionClient } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { revalidateCacheTags } from "../../../cache/revalidate-cache-tags";
import { getGoalsCacheTag } from "../../../cache/tags";
import { oweFollowUps } from "../../../follow-ups/owe-follow-ups";
import { loadPlacementPlan } from "../../_utils/goal-skill-graph";
import { unchanged, writeLearnerChange } from "../../_utils/write-learner-change";
import {
  type PlacementLength,
  type PlacementRecord,
  getPlacementEstimate,
  getTopicsAhead,
  readPlacementAttempt,
} from "./placement-attempt-record";

export async function savePlacementAttempt({
  goal,
  record,
  tx,
}: {
  goal: Pick<Goal, "details" | "id">;
  record: PlacementRecord;
  tx: TransactionClient;
}) {
  await tx.goal.update({
    data: {
      details: { ...(isJsonObject(goal.details) ? goal.details : {}), placementTest: record },
    },
    where: { id: goal.id },
  });
}

export async function openPlacementAttempt({
  goalId,
  length,
  userId,
}: {
  goalId: string;
  length: PlacementLength;
  userId: string;
}) {
  await writeLearnerChange({ goalIds: [goalId], planInputs: true, userId }, async (tx) => {
    const goal = await tx.goal.findUniqueOrThrow({ where: { id: goalId } });
    const record = readPlacementAttempt(goal);

    if (record.attempt && !record.attempt.partComplete) {
      return unchanged(null);
    }

    const at = new Date().toISOString();

    if (record.attempt) {
      await savePlacementAttempt({
        goal,
        record: {
          ...record,
          attempt: {
            ...record.attempt,
            part: record.attempt.part + 1,
            partComplete: false,
            partStartedAt: at,
          },
        },
        tx,
      });

      return;
    }

    const plan = await loadPlacementPlan(goalId, tx);
    const skillIds = getTopicsAhead(plan).map((skill) => skill.id);

    const attempt = {
      estimatedMinutes: getPlacementEstimate({ length, topics: skillIds.length }),
      id: randomUUID(),
      length,
      lessonsSkipped: 0,
      part: 1,
      partComplete: false,
      partStartedAt: at,
      skillIds,
      topicCount: skillIds.length,
    };

    await savePlacementAttempt({ goal, record: { ...record, attempt }, tx });
    await tx.plan.updateMany({ data: { placementPreparedAt: null }, where: { goalId } });

    await oweFollowUps({
      db: tx,
      followUps: [{ input: { goalId, waitsForNotice: false }, kind: "preparePlacementItems" }],
      userId,
    });
  });

  revalidateCacheTags([getGoalsCacheTag(userId)]);
}

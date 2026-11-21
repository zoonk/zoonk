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
  TOPICS_PER_PART,
  getPlacementEstimate,
  getTopicsAhead,
  readPlacementAttempt,
  readReadyAssessmentId,
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

async function owePartQuestions({
  goalId,
  placementPart,
  skillIds,
  tx,
  userId,
}: {
  goalId: string;
  placementPart?: { attemptId: string; part: number };
  skillIds: string[];
  tx: TransactionClient;
  userId: string;
}) {
  if (placementPart && skillIds.length === 0) {
    return;
  }

  if (!placementPart) {
    await tx.plan.updateMany({ data: { placementPreparedAt: null }, where: { goalId } });
  }

  await oweFollowUps({
    db: tx,
    followUps: [
      {
        input: {
          goalId,
          ...(placementPart && { placementPart }),
          ...(skillIds.length > 0 && { skillIds }),
          waitsForNotice: false,
        },
        kind: "preparePlacementItems",
      },
    ],
    userId,
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
  const opened = await writeLearnerChange(
    { goalIds: [goalId], planInputs: true, userId },
    async (tx) => {
      const goal = await tx.goal.findUniqueOrThrow({ where: { id: goalId } });
      const record = readPlacementAttempt(goal);
      const assessmentId = goal.kind === "language" ? readReadyAssessmentId(goal.details) : null;

      const allowed =
        goal.kind === "learn" ||
        (goal.kind === "language" &&
          length === "wholeCourse" &&
          Boolean(record.attempt || assessmentId));

      if (!allowed) {
        return unchanged(false);
      }

      if (
        (record.attempt && !record.attempt.partComplete) ||
        (!record.attempt && assessmentId !== null && record.assessmentId === assessmentId)
      ) {
        return unchanged(true);
      }

      const at = new Date().toISOString();

      if (record.attempt) {
        const remaining = record.attempt.remainingSkillIds ?? record.attempt.skillIds;
        const partSkillIds = remaining.slice(0, TOPICS_PER_PART);
        const part = record.attempt.part + 1;

        await owePartQuestions({
          goalId,
          placementPart: { attemptId: record.attempt.id, part },
          skillIds: remaining.slice(0, TOPICS_PER_PART * 2),
          tx,
          userId,
        });

        await savePlacementAttempt({
          goal,
          record: {
            ...record,
            attempt: {
              ...record.attempt,
              part,
              partComplete: false,
              partPrepared: false,
              partSkillIds,
              partStartedAt: at,
            },
          },
          tx,
        });

        return true;
      }

      const plan = await loadPlacementPlan(goalId, tx);

      if (length === "wholeCourse" && plan.skills.length === 0) {
        return unchanged(false);
      }

      const skillIds = getTopicsAhead(plan).map((skill) => skill.id);

      const attempt = {
        estimatedMinutes: getPlacementEstimate({ length, topics: skillIds.length }),
        id: randomUUID(),
        length,
        lessonsSkipped: 0,
        part: 1,
        partComplete: false,
        ...(length === "wholeCourse" && {
          partPrepared: false,
          partSkillIds: skillIds.slice(0, TOPICS_PER_PART),
        }),
        partStartedAt: at,
        skillIds,
        topicCount: skillIds.length,
      };

      await savePlacementAttempt({
        goal,
        record: { ...record, ...(assessmentId && { assessmentId }), attempt },
        tx,
      });

      await owePartQuestions({
        goalId,
        placementPart: length === "wholeCourse" ? { attemptId: attempt.id, part: 1 } : undefined,
        skillIds: length === "wholeCourse" ? skillIds.slice(0, TOPICS_PER_PART * 2) : skillIds,
        tx,
        userId,
      });

      return true;
    },
  );

  if (opened) {
    revalidateCacheTags([getGoalsCacheTag(userId)]);
  }

  return opened;
}

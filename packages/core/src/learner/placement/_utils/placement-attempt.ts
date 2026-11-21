import "server-only";
import { randomUUID } from "node:crypto";
import { type Goal, type TransactionClient } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { isUuid } from "@zoonk/utils/uuid";
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

function readReadyAssessmentId(details: unknown): string | null {
  const levelTest = isJsonObject(details) ? details.levelTest : null;
  const attempt = isJsonObject(levelTest) ? levelTest.attempt : null;

  if (
    !isJsonObject(attempt) ||
    !isJsonObject(attempt.result) ||
    attempt.result.wholeCourseReady !== true ||
    typeof attempt.attemptId !== "string" ||
    !isUuid(attempt.attemptId)
  ) {
    return null;
  }

  return attempt.attemptId;
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

        return true;
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

      await savePlacementAttempt({
        goal,
        record: { ...record, ...(assessmentId && { assessmentId }), attempt },
        tx,
      });

      await tx.plan.updateMany({ data: { placementPreparedAt: null }, where: { goalId } });

      await oweFollowUps({
        db: tx,
        followUps: [
          {
            input: { goalId, ...(skillIds.length > 0 && { skillIds }), waitsForNotice: false },
            kind: "preparePlacementItems",
          },
        ],
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

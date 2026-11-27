import "server-only";
import { randomUUID } from "node:crypto";
import { type Goal, type TransactionClient } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { revalidateCacheTags } from "../../../cache/revalidate-cache-tags";
import { getGoalsCacheTag } from "../../../cache/tags";
import { oweFollowUps } from "../../../follow-ups/owe-follow-ups";
import { loadPlacementPlan } from "../../_utils/goal-skill-graph";
import { unchanged, writeLearnerChange } from "../../_utils/write-learner-change";
import { loadCoursePlacementTopics } from "./course-placement-offer";
import { loadPlacementWithSummary } from "./load-placement-state";
import {
  type PlacementLength,
  type PlacementRecord,
  getAttemptParts,
  readPlacementAttempt,
  readReadyAssessmentId,
  splitPlacementParts,
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

async function resumePlacementAttempt({
  at,
  current,
  goal,
  length,
  record,
  tx,
}: {
  at: string;
  current: NonNullable<PlacementRecord["attempt"]>;
  goal: Pick<Goal, "details" | "id" | "userId">;
  length: PlacementLength;
  record: PlacementRecord;
  tx: TransactionClient;
}) {
  const { id: goalId, userId } = goal;

  if (!current.partComplete) {
    if (!current.paused && (current.length === length || length === "quick")) {
      return unchanged(true);
    }

    await savePlacementAttempt({
      goal,
      record: {
        ...record,
        attempt: {
          ...current,
          length: length === "wholeCourse" ? length : current.length,
          paused: false,
        },
      },
      tx,
    });

    return true;
  }

  if (current.length === "quick" && length === "quick") {
    return unchanged(true);
  }

  const plan = await loadPlacementPlan(goalId, tx);
  const { attemptNextPart } = await loadPlacementWithSummary({ goalId, plan, tx, userId });

  if (!attemptNextPart) {
    return unchanged(true);
  }

  const { ids: partSkillIds, part } = attemptNextPart;

  await owePartQuestions({
    goalId,
    placementPart: { attemptId: current.id, part },
    skillIds: partSkillIds,
    tx,
    userId,
  });

  await savePlacementAttempt({
    goal,
    record: {
      ...record,
      attempt: {
        ...current,
        length: "wholeCourse",
        part,
        partComplete: false,
        partPrepared: false,
        partSkillIds,
        partStartedAt: at,
        parts: getAttemptParts(current),
        paused: false,
      },
    },
    tx,
  });

  return true;
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

      if (!record.attempt && assessmentId !== null && record.assessmentId === assessmentId) {
        return unchanged(true);
      }

      const at = new Date().toISOString();

      if (record.attempt) {
        return resumePlacementAttempt({ at, current: record.attempt, goal, length, record, tx });
      }

      const topics = await loadCoursePlacementTopics(goalId, tx);
      const skillIds = topics.map((skill) => skill.id);
      const parts = splitPlacementParts(skillIds);
      const first = parts[0];

      if (!first) {
        return unchanged(false);
      }

      const attempt = {
        id: randomUUID(),
        length,
        lessonsSkipped: 0,
        part: 1,
        partComplete: false,
        partSkillIds: first,
        partStartedAt: at,
        parts,
        skillIds,
      };

      await savePlacementAttempt({
        goal,
        record: { ...record, ...(assessmentId && { assessmentId }), attempt, finishedParts: [] },
        tx,
      });

      if (goal.planRevealedAt || goal.kind === "language") {
        await owePartQuestions({ goalId, skillIds: first, tx, userId });
      }

      return true;
    },
  );

  if (opened) {
    revalidateCacheTags([getGoalsCacheTag(userId)]);
  }

  return opened;
}

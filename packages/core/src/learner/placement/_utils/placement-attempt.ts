import "server-only";
import { randomUUID } from "node:crypto";
import { type Goal, type TransactionClient } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { revalidateCacheTags } from "../../../cache/revalidate-cache-tags";
import { getGoalsCacheTag } from "../../../cache/tags";
import { type PlacementPartPreparation } from "../../../follow-ups/follow-up-contract";
import { oweFollowUps } from "../../../follow-ups/owe-follow-ups";
import { loadPlacementPlan } from "../../_utils/goal-skill-graph";
import { unchanged, writeLearnerChange } from "../../_utils/write-learner-change";
import { loadCoursePlacementTopics } from "./course-placement-offer";
import { loadPlacementWithSummary } from "./load-placement-state";
import {
  type PlacementAttempt,
  type PlacementLength,
  type PlacementRecord,
  getAttemptParts,
  readPlacementAttempt,
  splitPlacementParts,
} from "./placement-attempt-record";
import { QUESTION_WRITING_WINDOW_MS } from "./placement-plan-build";

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
  placementPart: PlacementPartPreparation;
  skillIds: string[];
  tx: TransactionClient;
  userId: string;
}) {
  if (skillIds.length === 0) {
    return;
  }

  await oweFollowUps({
    db: tx,
    followUps: [
      {
        input: { goalId, placementPart, skillIds, waitsForNotice: false },
        kind: "preparePlacementItems",
      },
    ],
    userId,
  });
}

async function retryPartQuestions({
  at,
  current,
  goal,
  tx,
}: {
  at: string;
  current: PlacementAttempt;
  goal: Pick<Goal, "id" | "userId">;
  tx: TransactionClient;
}): Promise<PlacementAttempt> {
  const waited = Date.parse(at) - Date.parse(current.partRequestedAt ?? current.partStartedAt);

  if (
    !current.partPreparationFailed &&
    (current.partPrepared !== false || waited < QUESTION_WRITING_WINDOW_MS)
  ) {
    return current;
  }

  const { id: goalId, userId } = goal;
  const plan = await loadPlacementPlan(goalId, tx);
  const { attemptQuestions } = await loadPlacementWithSummary({ goalId, plan, tx, userId });

  if (!attemptQuestions?.preparationFailed) {
    return current;
  }

  await owePartQuestions({
    goalId,
    placementPart: { attemptId: current.id, part: current.part, requestedAt: at },
    skillIds: attemptQuestions.remainingTopics,
    tx,
    userId,
  });

  return { ...current, partPreparationFailed: false, partPrepared: false, partRequestedAt: at };
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
    const retried = await retryPartQuestions({ at, current, goal, tx });

    if (
      retried === current &&
      !current.paused &&
      (current.length === length || length === "quick")
    ) {
      return unchanged(true);
    }

    await savePlacementAttempt({
      goal,
      record: {
        ...record,
        attempt: {
          ...retried,
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
        partPreparationFailed: false,
        partPrepared: false,
        partRequestedAt: null,
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

      if (goal.kind !== "learn") {
        return unchanged(false);
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
        ...(goal.planRevealedAt && { partPrepared: false }),
        partSkillIds: first,
        partStartedAt: at,
        parts,
        skillIds,
      };

      await savePlacementAttempt({ goal, record: { ...record, attempt, finishedParts: [] }, tx });

      if (goal.planRevealedAt) {
        await owePartQuestions({
          goalId,
          placementPart: { attemptId: attempt.id, part: 1 },
          skillIds: first,
          tx,
          userId,
        });
      }

      return true;
    },
  );

  if (opened) {
    revalidateCacheTags([getGoalsCacheTag(userId)]);
  }

  return opened;
}

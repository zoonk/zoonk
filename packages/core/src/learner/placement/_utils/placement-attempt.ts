import "server-only";
import { randomUUID } from "node:crypto";
import { type Goal, type TransactionClient } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { type AnalyticsEvent } from "../../../analytics/events";
import { type TestRow } from "../../../analytics/test-event-catalog";
import { testEventContext, trackTestEvents } from "../../../analytics/test-events";
import { revalidateCacheTags } from "../../../cache/revalidate-cache-tags";
import { getGoalsCacheTag } from "../../../cache/tags";
import { type PlacementPartPreparation } from "../../../follow-ups/follow-up-contract";
import { oweFollowUps } from "../../../follow-ups/owe-follow-ups";
import { loadPlacementPlan } from "../../_utils/goal-skill-graph";
import { unchanged, writeLearnerChange } from "../../_utils/write-learner-change";
import { PART_QUESTIONS } from "../placement-budget";
import { loadCoursePlacementTopics } from "./course-placement-offer";
import { loadPlacementWithSummary } from "./load-placement-state";
import {
  type PlacementAttempt,
  type PlacementLength,
  type PlacementRecord,
  getAttemptParts,
  getCourseOffer,
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

function openingRow({
  attempt,
  goal,
  previous,
}: {
  attempt: PlacementAttempt;
  goal: Pick<Goal, "details" | "planRevealedAt">;
  previous?: PlacementAttempt;
}): TestRow {
  if (previous) {
    return previous.length === attempt.length ? "continue" : "whole_course";
  }

  if (
    !goal.planRevealedAt &&
    isJsonObject(goal.details) &&
    goal.details.placementRequested === true
  ) {
    return "direct";
  }

  return attempt.length === "wholeCourse" ? "whole_course" : "quick";
}

function openingEvents({
  attempt,
  goal,
  previous,
}: {
  attempt: PlacementAttempt;
  goal: Pick<Goal, "details" | "id" | "planRevealedAt" | "userId">;
  previous?: PlacementAttempt;
}): AnalyticsEvent[] {
  const parts = getAttemptParts(attempt).length;

  const properties = testEventContext(goal, {
    attemptId: attempt.id,
    part: attempt.part,
    parts,
    questions: attempt.parts
      ? (getCourseOffer(attempt.partSkillIds?.length ?? 0)?.questions ?? 0)
      : PART_QUESTIONS,
    test: "course",
  });

  const started: AnalyticsEvent = {
    name: "Test Started",
    properties: {
      ...properties,
      resumed: previous?.paused === true && previous.part === attempt.part,
      row: openingRow({ attempt, goal, previous }),
    },
  };

  if (!previous) {
    return [started];
  }

  const changedLength = previous.length !== attempt.length;

  const continued: AnalyticsEvent = {
    name: "Test Continued",
    properties: {
      ...properties,
      from_part: previous.part,
      reason: changedLength ? "whole_course" : "next_part",
    },
  };

  if (previous.part !== attempt.part || changedLength) {
    return previous.partComplete || previous.paused ? [continued, started] : [continued];
  }

  return previous.paused ? [started] : [];
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
  goal: Pick<Goal, "details" | "id" | "planRevealedAt" | "userId">;
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
      return unchanged({ events: [], goal });
    }

    const attempt = {
      ...retried,
      length: length === "wholeCourse" ? length : current.length,
      paused: false,
    };

    await savePlacementAttempt({ goal, record: { ...record, attempt }, tx });
    return { events: openingEvents({ attempt, goal, previous: current }), goal };
  }

  // Released Android sends the completed part's length when the learner taps Keep going.
  const plan = await loadPlacementPlan(goalId, tx);
  const { attemptQuestions } = await loadPlacementWithSummary({ goalId, plan, tx, userId });

  if (!attemptQuestions?.nextPart) {
    return unchanged({ events: [], goal });
  }

  const { ids: partSkillIds, part } = attemptQuestions.nextPart;

  await owePartQuestions({
    goalId,
    placementPart: { attemptId: current.id, part },
    skillIds: partSkillIds,
    tx,
    userId,
  });

  const attempt = {
    ...current,
    length: "wholeCourse" as const,
    part,
    partComplete: false,
    partPreparationFailed: false,
    partPrepared: false,
    partRequestedAt: null,
    partSkillIds,
    partStartedAt: at,
    parts: attemptQuestions.retainedParts,
    paused: false,
  };

  await savePlacementAttempt({ goal, record: { ...record, attempt }, tx });
  return { events: openingEvents({ attempt, goal, previous: current }), goal };
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
        return unchanged(null);
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
        return unchanged(null);
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

      return { events: openingEvents({ attempt, goal }), goal };
    },
  );

  if (opened) {
    revalidateCacheTags([getGoalsCacheTag(userId)]);
    trackTestEvents(opened.goal, opened.events);
  }
}

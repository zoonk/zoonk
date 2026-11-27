import "server-only";
import { randomUUID } from "node:crypto";
import { type Goal, type TransactionClient } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { testEventContext, trackTestEvents } from "../../../analytics/test-events";
import { revalidateCacheTags } from "../../../cache/revalidate-cache-tags";
import { getGoalsCacheTag } from "../../../cache/tags";
import { oweFollowUps } from "../../../follow-ups/owe-follow-ups";
import { unchanged, writeLearnerChange } from "../../_utils/write-learner-change";
import { readCourseBank } from "./course-placement-bank";
import {
  type PlacementRecord,
  getCourseOffer,
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

export async function openPlacementAttempt({ goalId, userId }: { goalId: string; userId: string }) {
  const opened = await writeLearnerChange(
    { goalIds: [goalId], planInputs: true, userId },
    async (tx) => {
      const goal = await tx.goal.findUniqueOrThrow({ where: { id: goalId } });
      const record = readPlacementAttempt(goal);
      if (goal.kind !== "learn") return unchanged(null);
      if (record.attempt) {
        if (!record.attempt.paused) return unchanged(null);
        await savePlacementAttempt({
          goal,
          record: { ...record, attempt: { ...record.attempt, paused: false } },
          tx,
        });
        return { goal, event: null };
      }
      const bank = await readCourseBank(goal, tx);
      const offer = getCourseOffer(bank.topics.length);
      if (!bank.possible && bank.topics.length > 0) return unchanged(null);
      const id = randomUUID();
      const attempt = {
        id,
        length: "quick" as const,
        part: 1,
        partComplete: false,
        lessonsSkipped: 0,
        skillIds: bank.topics.map((t) => t.id),
        partStartedAt: new Date().toISOString(),
        search: {
          position: bank.position,
          questions: offer?.questions ?? 8,
          topics: bank.ready ? bank.topics : null,
        },
      };
      await savePlacementAttempt({ goal, record: { ...record, attempt, finishedParts: [] }, tx });
      if (!bank.ready)
        await oweFollowUps({
          db: tx,
          userId,
          followUps: [
            {
              kind: "preparePlacementItems",
              input: { goalId, skillIds: bank.ids, waitsForNotice: false },
            },
          ],
        });
      return {
        goal,
        event: {
          name: "Test Started" as const,
          properties: {
            ...testEventContext(goal, {
              attemptId: id,
              part: 1,
              parts: 1,
              questions: attempt.search.questions,
              test: "course",
            }),
            resumed: false,
            row: goal.planRevealedAt ? ("quick" as const) : ("direct" as const),
          },
        },
      };
    },
  );
  if (opened) {
    revalidateCacheTags([getGoalsCacheTag(userId)]);
    if (opened.event) trackTestEvents(opened.goal, [opened.event]);
  }
}

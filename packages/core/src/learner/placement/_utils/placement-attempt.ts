import { randomUUID } from "node:crypto";
import "server-only";
import { type Goal, type TransactionClient } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { testEventContext, trackTestEvents } from "../../../analytics/test-events";
import { revalidateCacheTags } from "../../../cache/revalidate-cache-tags";
import { getGoalsCacheTag } from "../../../cache/tags";
import { oweFollowUps } from "../../../follow-ups/owe-follow-ups";
import { unchanged, writeLearnerChange } from "../../_utils/write-learner-change";
import { COURSE_QUESTION_LIMIT } from "../course-search";
import { readCourseBank } from "./course-placement-bank";
import {
  type StoredPlacement,
  getCourseOffer,
  readPlacementAttempt,
} from "./placement-attempt-record";
import { coursePreparationFailed } from "./placement-plan-build";

export async function savePlacementAttempt({
  goal,
  record,
  tx,
}: {
  goal: Pick<Goal, "details" | "id">;
  record: StoredPlacement;
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

      if (goal.kind !== "learn") {
        return unchanged(null);
      }

      if (record.attempt && !coursePreparationFailed(record.attempt)) {
        return unchanged(null);
      }

      const bank = await readCourseBank(goal, tx);
      const offer = getCourseOffer(bank.topics.length);

      if (!bank.possible && bank.topics.length > 0) {
        return unchanged(null);
      }

      const id = record.attempt?.id ?? randomUUID();

      const attempt = {
        id,
        partStartedAt: new Date().toISOString(),
        search: {
          position: bank.position,
          questions: offer?.questions ?? COURSE_QUESTION_LIMIT,
          topics: bank.ready ? bank.topics : null,
        },
      };

      await savePlacementAttempt({ goal, record: { attempt, result: record.result }, tx });

      if (!bank.ready && bank.ids.length > 0) {
        await oweFollowUps({
          db: tx,
          followUps: [
            {
              input: { goalId, skillIds: bank.ids, waitsForNotice: false },
              kind: "preparePlacementItems",
            },
          ],
          userId,
        });
      }

      if (record.attempt) {
        return { event: null, goal };
      }

      return {
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
        goal,
      };
    },
  );

  if (opened) {
    revalidateCacheTags([getGoalsCacheTag(userId)]);

    if (opened.event) {
      trackTestEvents(opened.goal, [opened.event]);
    }
  }
}

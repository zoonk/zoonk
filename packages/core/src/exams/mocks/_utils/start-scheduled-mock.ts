import { type Goal, type StudySessionBlock, type TransactionClient } from "@zoonk/db";
import { findActiveSubscriptionForUser } from "../../../auth/subscription";
import { oweFollowUps } from "../../../follow-ups/owe-follow-ups";
import { readBlockPayload } from "../../../sessions/block-payload";
import { readExamPicks } from "../../choices/exam-choices";
import { buildMockConditions } from "./mock-conditions";
import { claimMockItems, releaseExpiredMockItems } from "./mock-item-uses";
import { hasStoredTimeRunOutAway } from "./owned-mock";
import { readScheduledStructure, readUnpickedChoices } from "./read-mock-structure";

export async function startScheduledSitting({
  tx,
  block,
  goal,
  sessionDate,
  userId,
  now,
}: {
  tx: TransactionClient;
  block: StudySessionBlock;
  goal: Goal | null;
  sessionDate: Date;
  userId: string;
  now: Date;
}): Promise<"created" | "ready" | "preparing" | "finished" | "plusRequired" | null> {
  const payload = readBlockPayload(block);

  if (!goal || !payload.checkpoint?.mock) {
    return null;
  }

  const existing = await tx.mockExam.findUnique({
    include: { answers: { select: { answer: true } } },
    where: { blockId: block.id },
  });

  if (existing && !hasStoredTimeRunOutAway({ mock: existing, now: now.getTime() })) {
    return existing.status === "active" ? "ready" : "finished";
  }

  if (!(await findActiveSubscriptionForUser({ client: tx, now, userId }))) {
    return "plusRequired";
  }

  await releaseExpiredMockItems(tx, userId);

  if (existing) {
    await tx.mockExam.update({ data: { blockId: null }, where: { id: existing.id } });

    await tx.studySessionBlock.update({
      data: {
        payload: { ...payload, itemIds: [], timing: { activeAt: null, clock: null, elapsedMs: 0 } },
        startedAt: null,
        status: "pending",
      },
      where: { id: block.id },
    });
  }

  const blueprint = goal.examBlueprintId
    ? await tx.examBlueprint.findUnique({ where: { id: goal.examBlueprintId } })
    : null;

  const plan = await tx.plan.findUnique({ select: { settings: true }, where: { goalId: goal.id } });
  const picks = readExamPicks(plan?.settings);

  const { conditions, complete } = await buildMockConditions(
    {
      blueprint,
      goal,
      payload,
      sessionDate,
      structure: readScheduledStructure({
        blueprint,
        date: sessionDate,
        goal,
        settings: plan?.settings,
      }),
      unpicked: readUnpickedChoices({ blueprint, picks }),
      userId,
    },
    tx,
  );

  await oweFollowUps({
    db: tx,
    followUps: [
      {
        input: { examBlueprintId: goal.examBlueprintId, goalId: goal.id, later: complete },
        kind: "prepareMockSupply",
      },
    ],
    userId,
  });

  if (!complete) {
    return "preparing";
  }

  const sitting = await tx.mockExam.create({
    data: {
      blockId: block.id,
      conditions: { ...conditions, examQuestions: null },
      examBlueprintId: goal.examBlueprintId,
      goalId: goal.id,
      sectionStartedAt: now,
      startedAt: now,
      userId,
    },
  });

  await claimMockItems({ conditions, mockExamId: sitting.id, now, tx, userId });
  return "created";
}

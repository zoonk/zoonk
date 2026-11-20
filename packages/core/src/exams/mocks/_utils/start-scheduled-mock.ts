import { type Goal, type StudySessionBlock, type TransactionClient } from "@zoonk/db";
import { oweFollowUps } from "../../../follow-ups/owe-follow-ups";
import { readBlockPayload } from "../../../sessions/block-payload";
import { readExamPicks } from "../../choices/exam-choices";
import { buildMockConditions } from "./mock-conditions";
import { claimMockItems, releaseExpiredMockItems } from "./mock-item-uses";
import { hasStoredTimeRunOutAway } from "./owned-mock";
import { readMockStructure, readUnpickedChoices } from "./read-mock-structure";

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
  goal: Goal;
  sessionDate: Date;
  userId: string;
  now: Date;
}): Promise<"created" | "ready" | "preparing" | "finished"> {
  const existing = await tx.mockExam.findUnique({
    where: { blockId: block.id },
    include: { answers: { select: { answer: true } } },
  });
  if (existing && !hasStoredTimeRunOutAway({ mock: existing, now: now.getTime() }))
    return existing.status === "active" ? "ready" : "finished";
  await releaseExpiredMockItems(tx, userId);
  if (existing) await tx.mockExam.update({ where: { id: existing.id }, data: { blockId: null } });
  const blueprint = goal.examBlueprintId
    ? await tx.examBlueprint.findUnique({ where: { id: goal.examBlueprintId } })
    : null;
  const plan = await tx.plan.findUnique({ where: { goalId: goal.id }, select: { settings: true } });
  const picks = readExamPicks(plan?.settings);
  const payload = readBlockPayload(block);
  const conditions = await buildMockConditions(
    {
      goal,
      blueprint,
      payload,
      sessionDate,
      structure: blueprint && readMockStructure({ blueprint, picks }),
      unpicked: readUnpickedChoices({ blueprint, picks }),
      userId,
    },
    tx,
  );
  const count = conditions.sections.reduce((sum, section) => sum + section.questions, 0);
  const complete =
    count === (payload.checkpoint?.mockQuestions ?? conditions.examQuestions) &&
    conditions.sections.length > 0;
  await oweFollowUps({
    db: tx,
    userId,
    followUps: [
      {
        kind: "prepareMockSupply",
        input: { goalId: goal.id, examBlueprintId: goal.examBlueprintId, later: complete },
      },
    ],
  });
  if (!complete) return "preparing";
  const sitting = await tx.mockExam.create({
    data: {
      goalId: goal.id,
      examBlueprintId: goal.examBlueprintId,
      conditions: { ...conditions, examQuestions: null },
      blockId: block.id,
      sectionStartedAt: now,
      startedAt: now,
      userId,
    },
  });
  await claimMockItems({ tx, userId, conditions, mockExamId: sitting.id, now });
  return "created";
}

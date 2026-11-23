import { type Goal, type StudySessionBlock, type TransactionClient } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { findActiveSubscriptionForUser } from "../../../auth/subscription";
import { lockUsageForViewer } from "../../../entitlements/_utils/usage-lock";
import { oweFollowUps } from "../../../follow-ups/owe-follow-ups";
import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { readBlueprintContent } from "../../../library/exams/save-exam-blueprint";
import { type BlockPayload, readBlockPayload } from "../../../sessions/block-payload";
import { readExamPicks } from "../../choices/exam-choices";
import { admitWriting } from "../../essays/writing-admission";
import { type WritingNeedsChoice } from "../../essays/writing-contract";
import { type MockConditions } from "../mock-contract";
import { snapshotMockWriting } from "../mock-written-points";
import { type MockEssayCandidate, listMockWrittenRequests } from "../written-parts";
import { bindMockWriting } from "../written-test-plan";
import { buildMockConditions } from "./mock-conditions";
import { claimMockItems, releaseExpiredMockItems } from "./mock-item-uses";
import { clearStartedPaperRequest, recordMockPaperRequest } from "./mock-supply-request";
import { getMockWritingAvailability } from "./mock-writing-choices";
import { findMockWriting } from "./mock-writing-supply";
import { hasStoredTimeRunOutAway } from "./owned-mock";
import { readScheduledStructure, readUnpickedChoices } from "./read-mock-structure";
import { readScheduledPaper } from "./scheduled-mock";

type ScheduledStart = {
  tx: TransactionClient;
  block: StudySessionBlock;
  goal: Goal;
  sessionDate: Date;
  userId: string;
};

/** The paper as planned from the bank, and the exam choice its written questions still wait for. */
async function planScheduledPaper({
  tx,
  goal,
  payload,
  sessionDate,
  userId,
}: Omit<ScheduledStart, "block"> & { payload: BlockPayload }) {
  const blueprint = goal.examBlueprintId
    ? await tx.examBlueprint.findUnique({ where: { id: goal.examBlueprintId } })
    : null;

  const plan = await tx.plan.findUnique({
    select: { graph: true, settings: true },
    where: { goalId: goal.id },
  });

  const picks = readExamPicks(plan?.settings);

  const structure = readScheduledStructure({
    blueprint,
    date: sessionDate,
    goal,
    settings: plan?.settings,
  });

  const { conditions, hasQuestions } = await buildMockConditions({
    client: tx,
    graph: plan?.graph,
    owned: {
      blueprint,
      goal,
      payload,
      sessionDate,
      structure,
      unpicked: readUnpickedChoices({ blueprint, picks }),
      userId,
    },
  });

  const sittingKind = conditions.fullLength ? "full" : "half";

  const shape = {
    day: conditions.day,
    kind: payload.checkpoint?.written ? "written" : sittingKind,
  } as const;

  return {
    availability: getMockWritingAvailability({
      picks,
      shape,
      structure: blueprint ? readBlueprintContent(blueprint).structure : null,
    }),
    conditions,
    hasQuestions,
    shape,
    structure,
  };
}

async function createSitting({
  tx,
  block,
  essays,
  goal,
  now,
  paper,
  planned,
  structure,
  timeZone,
  userId,
}: Omit<ScheduledStart, "sessionDate"> & {
  essays: MockEssayCandidate[];
  now: Date;
  paper: string;
  planned: MockConditions;
  structure: ExamStructure | null;
  timeZone: string;
}) {
  const sections = bindMockWriting({
    day: planned.day,
    essays,
    sections: planned.sections,
    structure,
  });

  if (!sections) {
    throw new Error(`Mock block ${block.id} has written prompts its paper can't seat.`);
  }

  const conditions = {
    ...planned,
    examQuestions: null,
    sections,
    ...snapshotMockWriting({ day: planned.day, essays, structure }),
  };

  const sitting = await tx.mockExam.create({
    data: {
      blockId: block.id,
      conditions,
      examBlueprintId: goal.examBlueprintId,
      goalId: goal.id,
      sectionStartedAt: now,
      startedAt: now,
      userId,
    },
  });

  if (essays.length > 0) {
    const admitted = await admitWriting({
      extra: false,
      itemIds: essays.map((essay) => essay.itemId),
      localDate: getDateInTimeZone({ date: now, timeZone }),
      owner: { mock: sitting },
      tx,
      userId,
    });

    if (admitted.status !== "ready") {
      return "signUpRequired" as const;
    }
  }

  await claimMockItems({ conditions, mockExamId: sitting.id, now, tx, userId });
  await clearStartedPaperRequest({ goal, paper, tx });
  return "created" as const;
}

/** A sitting whose time ran out while the learner was away leaves its block free to start again. */
async function releaseExpiredSitting({
  tx,
  block,
  mockExamId,
  payload,
}: Pick<ScheduledStart, "block" | "tx"> & { mockExamId: string; payload: BlockPayload }) {
  await tx.mockExam.update({ data: { blockId: null }, where: { id: mockExamId } });

  await tx.studySessionBlock.update({
    data: {
      payload: { ...payload, itemIds: [], timing: { activeAt: null, clock: null, elapsedMs: 0 } },
      startedAt: null,
      status: "pending",
    },
    where: { id: block.id },
  });
}

/** A caller rolls its transaction back on `signUpRequired` and on an exam choice the paper waits for. */
export async function startScheduledSitting({
  goal,
  now,
  timeZone,
  ...start
}: Omit<ScheduledStart, "goal"> & { goal: Goal | null; now: Date; timeZone: string }): Promise<
  | "created"
  | "ready"
  | "preparing"
  | "finished"
  | "plusRequired"
  | "signUpRequired"
  | WritingNeedsChoice
  | null
> {
  const { block, sessionDate, tx, userId } = start;
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
    await releaseExpiredSitting({ block, mockExamId: existing.id, payload, tx });
  }

  const planned = await planScheduledPaper({ ...start, goal, payload });

  if (planned.availability) {
    return planned.availability;
  }

  const { shape, structure } = planned;

  if (listMockWrittenRequests({ shape, structure }).length > 0) {
    await lockUsageForViewer({ transaction: tx, userId });
  }

  const writing = await findMockWriting({ goal, goalId: goal.id, shape, structure, tx, userId });
  const complete = planned.hasQuestions && writing.status === "ready";

  const scheduledPaper = payload.planItemId
    ? await readScheduledPaper({ client: tx, goalId: goal.id, planItemId: payload.planItemId })
    : null;

  const paper = scheduledPaper ?? sessionDate.toISOString();

  if (!complete && !(await recordMockPaperRequest({ goal, paper, tx }))) {
    return "preparing";
  }

  await oweFollowUps({
    db: tx,
    followUps: [
      {
        input: {
          examBlueprintId: goal.examBlueprintId,
          goalId: goal.id,
          later: complete,
          ...(!complete && { paper }),
        },
        kind: "prepareMockSupply",
      },
    ],
    userId,
  });

  if (writing.status !== "ready" || !complete) {
    return "preparing";
  }

  return createSitting({
    block,
    essays: writing.essays,
    goal,
    now,
    paper,
    planned: planned.conditions,
    structure,
    timeZone,
    tx,
    userId,
  });
}

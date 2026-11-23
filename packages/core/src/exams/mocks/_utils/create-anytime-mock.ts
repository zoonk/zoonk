import "server-only";
import { type Goal, type TransactionClient } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { lockUsageForViewer } from "../../../entitlements/_utils/usage-lock";
import { USAGE_WINDOW_MS } from "../../../entitlements/limits";
import { oweFollowUps } from "../../../follow-ups/owe-follow-ups";
import { getAnswerTimeZone } from "../../../learner/_utils/owned-goal";
import { unchanged, writeLearnerChange } from "../../../learner/_utils/write-learner-change";
import { readBlueprintContent } from "../../../library/exams/save-exam-blueprint";
import { admitWriting, readWritingExtraLimit } from "../../essays/writing-admission";
import { getMockScoring, getPartialCredit, getWrongPenalty } from "../../scoring/mock-scoring";
import { type MockConditions } from "../mock-contract";
import { markPlannedItems } from "../mock-marking";
import { type MockOption } from "../mock-options";
import { type MockCandidate, type MockPlan, countPlannedQuestions } from "../mock-plan";
import { snapshotMockWriting } from "../mock-written-points";
import { type MockEssayCandidate, listMockWrittenRequests } from "../written-parts";
import { bindMockWriting, hasMockWriting } from "../written-test-plan";
import {
  type AnytimeMockSetup,
  findRunningAnytimeMock,
  listMissingRecordings,
} from "./anytime-mock-setup";
import { isPaperComplete } from "./mock-complete";
import { getExamStartTime } from "./mock-conditions";
import { claimMockItems, releaseExpiredMockItems } from "./mock-item-uses";
import {
  clearStartedPaperRequest,
  mockPaperKey,
  recordMockPaperRequest,
} from "./mock-supply-request";
import { findMockWriting } from "./mock-writing-supply";
import { planFromBank } from "./plan-from-bank";

export { planFromBank } from "./plan-from-bank";

export type CreateAnytimeMockResult =
  | { id: string; status: "running" | "started" }
  | { status: "preparing" }
  | { returnsOn: string; status: "limitReached" }
  | { status: "signUpRequired" };

/** A start passes `writing` from the prompts it read under its lock. */
export function isCompleteMock({
  option,
  setup,
  plan,
  writing = hasMockWriting({ essays: setup.essays, shape: option, structure: setup.structure }),
}: {
  option: MockOption;
  setup: AnytimeMockSetup;
  plan: MockPlan;
  writing?: boolean;
}) {
  return isPaperComplete({
    missingRecordings: listMissingRecordings({ option, setup }).length,
    plan,
    questions: option.questions,
    writing,
  });
}

export async function canReuseMockItems(
  client: TransactionClient,
  userId: string,
  now = new Date(),
) {
  const count = await client.mockExam.count({
    where: {
      conditions: { equals: "practice", path: ["purpose"] },
      startedAt: { gte: new Date(now.getTime() - USAGE_WINDOW_MS), lte: now },
      userId,
    },
  });

  return count >= 10;
}

function toConditions({
  candidates,
  essays,
  goal,
  option,
  plan,
  setup,
}: {
  candidates: readonly MockCandidate[];
  essays: readonly MockEssayCandidate[];
  goal: Goal;
  option: MockOption;
  plan: MockPlan;
  setup: AnytimeMockSetup;
}): MockConditions {
  const edition = setup.blueprint ? readBlueprintContent(setup.blueprint).edition : null;
  const asked = countPlannedQuestions(plan);

  return {
    day: plan.day,
    examQuestions: asked < option.questions ? option.questions : null,
    fullLength: option.kind === "full" || option.kind === "objective",
    ...markPlannedItems({ candidates, plan, structure: setup.structure }),
    ...(option.pacing && { pacing: option.pacing }),
    partialCredit: getPartialCredit(setup.structure),
    purpose: "practice",
    reused: plan.reused,
    scoring: getMockScoring({ blueprint: setup.blueprint, goal, structure: setup.structure }),
    sections: plan.sections,
    shape: { area: option.area, day: option.day, kind: option.kind },
    startTime: getExamStartTime({ day: plan.day, edition }),
    timeZone: edition?.timeZone ?? null,
    timedOutSections: [],
    unpicked: option.leftOut.flatMap((part) =>
      part.part === "choice" && part.name ? [part.name] : [],
    ),
    wrongPenalty: getWrongPenalty(setup.structure),
    ...snapshotMockWriting({ day: plan.day, essays, structure: setup.structure }),
  };
}

type AnytimeStart = { goal: Goal; option: MockOption; tx: TransactionClient; userId: string };

/** Saves the ask once and owes the run that writes its paper; a repeat while it's covered owes nothing. */
async function askForPaper({ goal, option, tx, userId }: AnytimeStart) {
  const shape = { area: option.area, day: option.day, kind: option.kind };

  const current = await tx.goal.findUniqueOrThrow({
    select: { id: true, requestedMock: true },
    where: { id: goal.id },
  });

  if (await recordMockPaperRequest({ goal: current, paper: shape, tx })) {
    await oweFollowUps({
      db: tx,
      followUps: [
        {
          input: {
            examBlueprintId: goal.examBlueprintId,
            goalId: goal.id,
            later: false,
            paper: mockPaperKey(shape),
          },
          kind: "prepareMockSupply",
        },
      ],
      userId,
    });
  }
}

async function openSitting({
  candidates,
  essays,
  goal,
  localDate,
  now,
  option,
  plan,
  reuse,
  setup,
  tx,
  userId,
}: AnytimeStart &
  Omit<Parameters<typeof toConditions>[0], "essays"> & {
    essays: MockEssayCandidate[];
    localDate: Date;
    now: Date;
    reuse: boolean;
  }) {
  const shape = { area: option.area, day: option.day, kind: option.kind };

  const sections = bindMockWriting({
    day: option.day,
    essays,
    sections: plan.sections,
    structure: setup.structure,
  });

  if (!sections) {
    throw new Error(`Mock option ${mockPaperKey(shape)} has written prompts its plan can't seat.`);
  }

  const conditions = toConditions({
    candidates,
    essays,
    goal,
    option,
    plan: { ...plan, sections },
    setup,
  });

  const created = await tx.mockExam.create({
    data: {
      conditions,
      examBlueprintId: setup.blueprint?.id ?? null,
      goalId: goal.id,
      sectionStartedAt: now,
      startedAt: now,
      userId,
    },
  });

  if (essays.length > 0) {
    const admission = await admitWriting({
      extra: true,
      itemIds: essays.map((essay) => essay.itemId),
      localDate,
      owner: { mock: created },
      tx,
      userId,
    });

    if (admission.status !== "ready") {
      return unchanged(admission);
    }
  }

  const current = await tx.goal.findUniqueOrThrow({
    select: { id: true, requestedMock: true },
    where: { id: goal.id },
  });

  await claimMockItems({ candidates, conditions, mockExamId: created.id, now, tx, userId });
  await clearStartedPaperRequest({ goal: current, paper: shape, tx });

  await oweFollowUps({
    db: tx,
    followUps: [
      ...(reuse
        ? []
        : [
            {
              input: { examBlueprintId: goal.examBlueprintId, goalId: goal.id, later: true },
              kind: "prepareMockSupply" as const,
            },
          ]),
      // The speaking paper is written while the learner sits the papers before it.
      ...(conditions.sections.some((section) => section.kind === "speaking")
        ? [{ input: { mockId: created.id }, kind: "writeSpeakingPaper" as const }]
        : []),
    ],
    userId,
  });

  return { id: created.id, status: "started" as const };
}

export async function createAnytimeMock({
  goal,
  option,
  setup,
  userId,
}: {
  goal: Goal;
  option: MockOption;
  setup: AnytimeMockSetup;
  userId: string;
}): Promise<CreateAnytimeMockResult> {
  const asksWriting = listMockWrittenRequests({ shape: option, structure: setup.structure });

  return writeLearnerChange<CreateAnytimeMockResult>({ userId }, async (tx) => {
    const running = await findRunningAnytimeMock({ client: tx, goalId: goal.id, userId });

    if (running) {
      return unchanged({ id: running.id, status: "running" });
    }

    const now = new Date();
    const localDate = getDateInTimeZone({ date: now, timeZone: getAnswerTimeZone({ goal }) });

    if (asksWriting.length > 0) {
      await lockUsageForViewer({ transaction: tx, userId });
      const refusal = await readWritingExtraLimit({ localDate, tx, userId });

      if (refusal) {
        return unchanged(refusal);
      }
    }

    await releaseExpiredMockItems(tx, userId);
    const reuse = await canReuseMockItems(tx, userId);
    const planned = await planFromBank({ client: tx, goal, option, reuse, setup, userId });

    const writing = await findMockWriting({
      goal,
      goalId: goal.id,
      shape: option,
      structure: setup.structure,
      tx,
      userId,
    });

    const complete = isCompleteMock({
      option,
      plan: planned.plan,
      setup: planned.available,
      writing: writing.status === "ready",
    });

    if (writing.status !== "ready" || !complete) {
      await askForPaper({ goal, option, tx, userId });
      return { status: "preparing" };
    }

    return openSitting({
      candidates: planned.candidates,
      essays: writing.essays,
      goal,
      localDate,
      now,
      option,
      plan: planned.plan,
      reuse,
      setup: planned.available,
      tx,
      userId,
    });
  });
}

import "server-only";
import { DbNull, type Goal, type TransactionClient } from "@zoonk/db";
import { USAGE_WINDOW_MS } from "../../../entitlements/limits";
import { oweFollowUps } from "../../../follow-ups/owe-follow-ups";
import { unchanged, writeLearnerChange } from "../../../learner/_utils/write-learner-change";
import { readBlueprintContent } from "../../../library/exams/save-exam-blueprint";
import { getMockScoring, getPartialCredit, getWrongPenalty } from "../../scoring/mock-scoring";
import { type MockConditions } from "../mock-contract";
import { markPlannedItems } from "../mock-marking";
import { type MockOption } from "../mock-options";
import { type MockCandidate, type MockPlan, countPlannedQuestions } from "../mock-plan";
import {
  type AnytimeMockSetup,
  findRunningAnytimeMock,
  listMissingRecordings,
} from "./anytime-mock-setup";
import { isPaperComplete } from "./mock-complete";
import { getExamStartTime } from "./mock-conditions";
import { claimMockItems, releaseExpiredMockItems } from "./mock-item-uses";
import { planFromBank } from "./plan-from-bank";

export { planFromBank } from "./plan-from-bank";

export type CreateAnytimeMockResult =
  | { id: string; status: "running" | "started" }
  | { status: "preparing" };

export function isCompleteMock({
  option,
  setup,
  plan,
}: {
  option: MockOption;
  setup: AnytimeMockSetup;
  plan: MockPlan;
}) {
  return isPaperComplete(
    plan,
    option.questions,
    option.written.length,
    listMissingRecordings({ option, setup }).length,
  );
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
  goal,
  option,
  plan,
  setup,
}: {
  candidates: readonly MockCandidate[];
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
    fullLength: option.kind === "full",
    ...markPlannedItems({ candidates, plan, structure: setup.structure }),
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
  };
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
  return writeLearnerChange<CreateAnytimeMockResult>({ userId }, async (tx) => {
    const running = await findRunningAnytimeMock({ client: tx, goalId: goal.id, userId });

    if (running) {
      return unchanged({ id: running.id, status: "running" });
    }

    await releaseExpiredMockItems(tx, userId);
    const reuse = await canReuseMockItems(tx, userId);

    const {
      candidates,
      plan,
      available: lockedSetup,
    } = await planFromBank({ client: tx, goal, option, reuse, setup, userId });

    if (!isCompleteMock({ option, plan, setup: lockedSetup })) {
      await tx.goal.update({
        data: { requestedMock: { area: option.area, day: option.day, kind: option.kind } },
        where: { id: goal.id },
      });

      await oweFollowUps({
        db: tx,
        followUps: [
          {
            input: { examBlueprintId: goal.examBlueprintId, goalId: goal.id, later: reuse },
            kind: "prepareMockSupply",
          },
        ],
        userId,
      });

      return { status: "preparing" };
    }

    const now = new Date();

    const conditions = toConditions({ candidates, goal, option, plan, setup: lockedSetup });

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

    await claimMockItems({ candidates, conditions, mockExamId: created.id, now, tx, userId });
    await tx.goal.update({ data: { requestedMock: DbNull }, where: { id: goal.id } });

    if (!reuse) {
      await oweFollowUps({
        db: tx,
        followUps: [
          {
            input: { examBlueprintId: goal.examBlueprintId, goalId: goal.id, later: true },
            kind: "prepareMockSupply",
          },
        ],
        userId,
      });
    }
    // The speaking paper is written while the learner sits the papers before it.
    if (conditions.sections.some((section) => section.kind === "speaking")) {
      await oweFollowUps({
        db: tx,
        followUps: [{ input: { mockId: created.id }, kind: "writeSpeakingPaper" }],
        userId,
      });
    }

    return { id: created.id, status: "started" };
  });
}

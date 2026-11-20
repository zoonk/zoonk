import "server-only";
import { DbNull, type TransactionClient, prisma, type Goal } from "@zoonk/db";
import { USAGE_WINDOW_MS } from "../../../entitlements/limits";
import { oweFollowUps } from "../../../follow-ups/owe-follow-ups";
import { unchanged, writeLearnerChange } from "../../../learner/_utils/write-learner-change";
import { readBlueprintContent } from "../../../library/exams/save-exam-blueprint";
import { parsePlanSettings } from "../../../plans/planner/plan-state";
import { getMockScoring, getPartialCredit, getWrongPenalty } from "../../scoring/mock-scoring";
import { type MockConditions } from "../mock-contract";
import { markPlannedItems } from "../mock-marking";
import { planOptionMock } from "../mock-option-plan";
import { type MockOption } from "../mock-options";
import {
  type MockCandidate,
  type MockPlan,
  getPlannedItemIds,
  countPlannedQuestions,
} from "../mock-plan";
import { countReused } from "../mock-reuse";
import {
  type AnytimeMockSetup,
  findRunningAnytimeMock,
  listMissingRecordings,
  loadMockSkillIds,
} from "./anytime-mock-setup";
import { loadMockCandidates } from "./mock-candidates";
import { getExamStartTime } from "./mock-conditions";
import { claimMockItems, releaseExpiredMockItems } from "./mock-item-uses";

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
  return (
    countPlannedQuestions(plan) === option.questions &&
    !listMissingRecordings({ option, setup }).length &&
    option.written.length === plan.sections.reduce((sum, section) => sum + section.essays.length, 0)
  );
}

export async function canReuseMockItems(client: TransactionClient, userId: string) {
  const count = await client.mockExam.count({
    where: {
      userId,
      startedAt: { gte: new Date(Date.now() - USAGE_WINDOW_MS) },
      conditions: { path: ["purpose"], equals: "practice" },
    },
  });
  return count >= 10;
}

export async function planFromBank({
  client = prisma,
  reuse = false,
  exclude,
  goal,
  option,
  setup,
  userId,
}: {
  goal: Goal;
  option: MockOption;
  setup: AnytimeMockSetup;
  userId: string;
  client?: TransactionClient;
  reuse?: boolean;
  exclude?: ReadonlySet<string>;
}): Promise<{ candidates: MockCandidate[]; plan: MockPlan }> {
  const loaded = await loadMockCandidates({
    client,
    reuse,
    goal,
    itemIds: null,
    skillIds: await loadMockSkillIds(goal.id),
    structure: setup.structure,
    userId,
  });

  const saved =
    reuse && !exclude
      ? await client.plan.findUnique({ where: { goalId: goal.id }, select: { settings: true } })
      : null;
  const protectedIds = new Set<string>(exclude);
  const upcoming = parsePlanSettings(saved?.settings)
    .mockFunding.filter((entry) => entry.date >= new Date().toISOString().slice(0, 10))
    .toSorted((a, b) => a.date.localeCompare(b.date))
    .slice(0, 2);
  for (const entry of upcoming) {
    const scheduled = setup.options.find(
      (candidate) =>
        candidate.kind === (entry.fullLength ? "full" : "half") &&
        candidate.day === (entry.day ?? null),
    );
    if (scheduled) {
      const reserved = planOptionMock({
        ...setup,
        option: scheduled,
        candidates: loaded.filter((item) => !item.answered && !protectedIds.has(item.itemId)),
      });
      getPlannedItemIds(reserved).forEach((id) => protectedIds.add(id));
    }
  }
  const candidates = loaded.filter((item) => !protectedIds.has(item.itemId));
  const freshPlan = planOptionMock({
    ...setup,
    option,
    candidates: candidates.filter((item) => !item.answered),
  });
  if (!reuse || countPlannedQuestions(freshPlan) === option.questions)
    return { candidates, plan: freshPlan };
  // The full-day planner normally excludes repeats. Fair use admits them after reserving the scheduled papers.
  const plan = planOptionMock({
    ...setup,
    option,
    candidates: candidates.map((item) => ({ ...item, answered: false })),
  });
  return {
    candidates,
    plan: { ...plan, reused: countReused({ candidates, sections: plan.sections }) },
  };
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
    ...markPlannedItems({
      candidates: [...candidates, ...[...setup.listening.values()].flat()],
      plan,
      structure: setup.structure,
    }),
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
    if (running) return unchanged({ id: running.id, status: "running" });
    await releaseExpiredMockItems(tx, userId);
    const reuse = await canReuseMockItems(tx, userId);
    const { candidates, plan } = await planFromBank({
      client: tx,
      goal,
      option,
      setup,
      userId,
      reuse,
    });
    if (!isCompleteMock({ option, setup, plan })) {
      await tx.goal.update({
        where: { id: goal.id },
        data: { requestedMock: { kind: option.kind, area: option.area, day: option.day } },
      });
      await oweFollowUps({
        db: tx,
        userId,
        followUps: [
          {
            kind: "prepareMockSupply",
            input: { goalId: goal.id, examBlueprintId: goal.examBlueprintId, later: reuse },
          },
        ],
      });
      return { status: "preparing" };
    }
    const now = new Date();

    const conditions = toConditions({ candidates, goal, option, plan, setup });

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

    await claimMockItems({ tx, userId, conditions, now, mockExamId: created.id });
    await tx.goal.update({ where: { id: goal.id }, data: { requestedMock: DbNull } });
    if (!reuse)
      await oweFollowUps({
        db: tx,
        userId,
        followUps: [
          {
            kind: "prepareMockSupply",
            input: { goalId: goal.id, examBlueprintId: goal.examBlueprintId, later: true },
          },
        ],
      });
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

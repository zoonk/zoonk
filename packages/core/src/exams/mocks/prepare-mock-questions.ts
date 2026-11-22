import { captureMessage } from "@sentry/nextjs";
import { getActiveSubscriptionFilter } from "@zoonk/auth/active-subscription";
import { DbNull, type Goal, type Plan, type PlanItem, prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { findActiveSubscriptionForUser } from "../../auth/subscription";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLearnerModelCacheTag } from "../../cache/tags";
import { writeLearnerChange } from "../../learner/_utils/write-learner-change";
import {
  type PlacementQuickFormat,
  getPlacementQuickFormat,
} from "../../learner/placement/placement-quick-format";
import "server-only";
import { parsePlanGraph } from "../../plans/planner/plan-state";
import { toListeningExam } from "../listening/listening-exam";
import { type PartsToPrepare } from "../listening/prepare-listening-part";
import {
  listMissingRecordings,
  loadAnytimeMockSetup,
  resolveAnytimeOption,
} from "./_utils/anytime-mock-setup";
import { canReuseMockItems, isCompleteMock } from "./_utils/create-anytime-mock";
import {
  mockPaperKey,
  readMockSupplyRequest,
  storedMockRequest,
} from "./_utils/mock-supply-request";
import { loadMockWriteSkills, planMockWrites } from "./_utils/mock-writes";
import { loadMockBank, planFromMockBank, planScheduledFromBank } from "./_utils/plan-from-bank";
import {
  SCHEDULED_SUPPLY_PLAN_SELECT,
  listScheduledSupplyOptions,
} from "./_utils/scheduled-supply-options";
import { getPlannedItemIds } from "./mock-plan";
import { type MockFormatShortfall } from "./mock-shortfall";

export type MockQuestionWrites = {
  recordings?: PartsToPrepare;
  allowStimulusSets?: boolean;
  alternative?: true;
  later: boolean;
  key: string;
  quickFormat: PlacementQuickFormat;
  writes: MockFormatShortfall[];
};

export async function listDueMockGoals() {
  const paid = await prisma.subscription.groupBy({
    by: ["referenceId"],
    where: getActiveSubscriptionFilter(new Date()),
  });

  const due = await prisma.goal.findMany({
    select: { examBlueprintId: true, id: true },
    where: {
      kind: "exam",
      plan: { isNot: null },
      status: "active",
      userId: { in: paid.map(({ referenceId }) => referenceId) },
    },
  });

  const exams = new Map(due.map((goal) => [goal.examBlueprintId ?? goal.id, goal]));

  return [...exams.values()].map((goal) => ({
    examBlueprintId: goal.examBlueprintId,
    goalId: goal.id,
    later: true,
  }));
}

export async function listExamSupplyGoals({
  goalId,
  examBlueprintId,
}: {
  goalId: string;
  examBlueprintId: string | null;
}) {
  if (!examBlueprintId) {
    return [goalId];
  }

  const peers = await prisma.goal.findMany({
    select: { id: true },
    where: {
      examBlueprintId,
      id: { not: goalId },
      kind: "exam",
      plan: { isNot: null },
      status: "active",
    },
  });

  return [goalId, ...peers.map((peer) => peer.id)];
}

export async function checkMockSupply(goalId: string, { priority }: { priority?: string } = {}) {
  const goal = await prisma.goal.findUnique({
    select: { requestedMock: true, userId: true },
    where: { id: goalId },
  });

  const result = await listMockPrepWrites({ goalId });

  if (goal) {
    const saved = readMockSupplyRequest(goal.requestedMock);

    const papers = result.papers.flatMap((paper) =>
      priority && paper.alternative && !saved.papers.includes(paper.key) ? [] : [paper.key],
    );

    if (JSON.stringify(saved.papers) !== JSON.stringify(papers)) {
      await writeLearnerChange({ userId: goal.userId }, (tx) =>
        tx.goal.updateMany({
          data: { requestedMock: storedMockRequest(saved.shape, papers) },
          where: { id: goalId, requestedMock: { equals: goal.requestedMock ?? DbNull } },
        }),
      );
    }

    revalidateCacheTags([getLearnerModelCacheTag(goal.userId)]);
  }

  if (result.urgentShort) {
    captureMessage("Mock exam questions are still short after preparation", {
      extra: { goalId },
      level: "warning",
    });
  }

  return priority
    ? result.papers.every((paper) => paper.key !== priority)
    : result.papers.length === 0;
}

type SupplyGoal = Goal & {
  plan: (Pick<Plan, "graph" | "settings"> & { items: Pick<PlanItem, "scheduledFor">[] }) | null;
};

async function planScheduledSupply({
  goal,
  setup,
}: {
  goal: SupplyGoal;
  setup: Awaited<ReturnType<typeof loadAnytimeMockSetup>>;
}) {
  const upcoming = await listScheduledSupplyOptions({ goal, plan: goal.plan });
  const exclude = new Set<string>();
  const papers = [];

  for (const paper of upcoming) {
    // oxlint-disable-next-line no-await-in-loop -- Each sitting reserves its own fresh questions.
    const planned = await planScheduledFromBank({
      ...paper,
      exclude,
      goal,
      paperPlan: goal.plan,
      setup,
    });

    papers.push({
      key: paper.scheduledFor.toISOString(),
      planned,
      urgent: paper.scheduledFor.getTime() <= Date.now() + 3 * MS_PER_DAY,
    });

    for (const id of getPlannedItemIds(planned.plan)) {
      exclude.add(id);
    }
  }

  return { exclude, papers };
}

async function planAnytimeSupply({
  exclude,
  goal,
  only,
  priority,
  reuse,
  setup,
}: {
  exclude: ReadonlySet<string>;
  goal: Goal;
  only?: string;
  priority?: string;
  reuse: boolean;
  setup: Awaited<ReturnType<typeof loadAnytimeMockSetup>>;
}) {
  const { shape } = readMockSupplyRequest(goal.requestedMock);
  const asked = shape && resolveAnytimeOption({ choice: { shape }, setup });
  const askedKey = asked && mockPaperKey(asked);

  const allowed = reuse || priority ? [asked].filter((option) => option !== null) : setup.options;
  const options = allowed.filter((option) => !only || mockPaperKey(option) === only);

  if (options.length === 0) {
    return [];
  }

  const bank = await loadMockBank({ exclude, goal, reuse, setup, userId: goal.userId });

  return options.map((option) => {
    const draft = planFromMockBank({ bank, option });
    const key = mockPaperKey(option);
    const urgent = key === askedKey;

    return {
      alternative: !urgent,
      key,
      planned: {
        ...draft,
        complete: isCompleteMock({ option, plan: draft.plan, setup: draft.available }),
        option,
      },
      urgent,
    };
  });
}

export async function listMockPrepWrites({
  goalId,
  priority,
  only,
}: {
  goalId: string;
  priority?: string;
  only?: string;
}): Promise<{ papers: MockQuestionWrites[]; urgentShort: boolean }> {
  const goal = await prisma.goal.findUnique({
    include: { plan: { select: SCHEDULED_SUPPLY_PLAN_SELECT } },
    where: { id: goalId },
  });

  if (
    goal?.kind !== "exam" ||
    goal.status !== "active" ||
    !(await findActiveSubscriptionForUser({ now: new Date(), userId: goal.userId }))
  ) {
    return { papers: [], urgentShort: false };
  }

  const [setup, reuse] = await Promise.all([
    loadAnytimeMockSetup(goal),
    canReuseMockItems(prisma, goal.userId),
  ]);

  const scheduled = await planScheduledSupply({ goal, setup });

  const anytime = await planAnytimeSupply({
    exclude: scheduled.exclude,
    goal,
    only,
    priority,
    reuse,
    setup,
  });

  const missing = [...scheduled.papers, ...anytime].filter(
    ({ key, planned }) => (!only || key === only) && !planned.complete,
  );

  const exam = toListeningExam({ ...goal, examBlueprint: setup.blueprint });
  const quickFormat = getPlacementQuickFormat(setup.structure);

  const skills =
    missing.length > 0
      ? await loadMockWriteSkills({ goalId, graph: parsePlanGraph(goal.plan?.graph) })
      : [];

  const papers = missing.map((target) => {
    const { option } = target.planned;
    const available = target.planned.available;
    const sections = listMissingRecordings({ option, setup: available });
    const parts = available.missingParts.filter((part) => sections.includes(part.sectionName));
    const writes = planMockWrites({ option, planned: target.planned, setup: available, skills });

    const alternative = "alternative" in target && target.alternative;

    return {
      ...(alternative && { alternative: true as const }),
      key: target.key,
      later: alternative || priority !== target.key,
      quickFormat,
      writes,
      ...(writes.length > 0 && !reuse ? { allowStimulusSets: true } : {}),
      ...(exam && parts.length > 0 && { recordings: { exam, parts } }),
    };
  });

  return { papers, urgentShort: missing.some(({ urgent }) => urgent) };
}

export { pickMockSetTargets } from "./mock-set-targets";
export { type MockWritingSkill, loadMockWritingSkills } from "./mock-writing-skills";

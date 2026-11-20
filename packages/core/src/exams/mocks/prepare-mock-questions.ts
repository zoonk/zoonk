import { captureMessage } from "@sentry/nextjs";
import { DbNull, prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { findActiveSubscriptionForUser } from "../../auth/subscription";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLearnerModelCacheTag } from "../../cache/tags";
import {
  type PlacementQuickFormat,
  getPlacementQuickFormat,
} from "../../learner/placement/placement-quick-format";
import { listPastQuestionExamples } from "../../library/items/past-question-examples";
import { loadUsedSituations } from "../../library/items/used-situations";
import "server-only";
import { toItemExam } from "../../lookahead/item-exam";
import { type PlacementItemSkill } from "../../lookahead/placement-item-skills";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import {
  loadAnytimeMockSetup,
  resolveAnytimeOption,
  listMissingRecordings,
} from "./_utils/anytime-mock-setup";
import { canReuseMockItems, planFromBank, isCompleteMock } from "./_utils/create-anytime-mock";
import { planMockWrites } from "./_utils/mock-writes";
import { mockShapeSchema } from "./mock-contract";
import { getPlannedItemIds } from "./mock-plan";
import { type MockFormatShortfall } from "./mock-shortfall";

export type MockQuestionWrites = {
  listening?: boolean;
  urgentShort?: boolean;
  quickFormat: PlacementQuickFormat;
  writes: MockFormatShortfall[];
};

export async function listDueMockGoals() {
  const now = new Date();
  const due = await prisma.goal.findMany({
    select: { id: true, examBlueprintId: true },
    where: {
      status: "active",
      kind: "exam",
      plan: {
        items: {
          some: {
            kind: "mock",
            status: "todo",
            scheduledFor: { lte: new Date(now.getTime() + 7 * MS_PER_DAY) },
          },
        },
      },
    },
  });
  return due.map((goal) => ({
    goalId: goal.id,
    examBlueprintId: goal.examBlueprintId,
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
  if (!examBlueprintId) return [goalId];
  const peers = await prisma.goal.findMany({
    select: { id: true },
    where: {
      id: { not: goalId },
      examBlueprintId,
      kind: "exam",
      status: "active",
      OR: [
        { requestedMock: { not: DbNull } },
        { plan: { items: { some: { kind: "mock", status: "todo" } } } },
      ],
    },
  });
  return [goalId, ...peers.map((peer) => peer.id)];
}

export async function checkMockSupply(goalId: string) {
  const result = await listMockPrepWrites({ goalId });
  const goal = await prisma.goal.findUnique({ where: { id: goalId }, select: { userId: true } });
  if (goal) revalidateCacheTags([getLearnerModelCacheTag(goal.userId)]);
  if (result.urgentShort)
    captureMessage("Mock exam questions are still short after preparation", {
      level: "warning",
      extra: { goalId },
    });
}

export async function listMockPrepWrites({
  goalId,
}: {
  goalId: string;
}): Promise<MockQuestionWrites> {
  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    include: {
      plan: {
        select: {
          settings: true,
          items: {
            where: { kind: "mock", status: "todo" },
            orderBy: { scheduledFor: "asc" },
            take: 2,
            select: { scheduledFor: true },
          },
        },
      },
    },
  });
  if (
    goal?.kind !== "exam" ||
    goal.status !== "active" ||
    !(await findActiveSubscriptionForUser({ userId: goal.userId, now: new Date() }))
  )
    return { quickFormat: "multipleChoice", writes: [] };
  const setup = await loadAnytimeMockSetup(goal);
  const shape = mockShapeSchema.safeParse(goal.requestedMock).data;
  const funding = parsePlanSettings(goal.plan?.settings).mockFunding;
  const scheduled = (goal.plan?.items ?? []).flatMap((item) => {
    const date = item.scheduledFor?.toISOString().slice(0, 10);
    const entry = funding.find((f) => f.date === date);
    const option =
      setup.options.find(
        (o) => o.kind === (entry?.fullLength ? "full" : "half") && o.day === (entry?.day ?? null),
      ) ?? setup.options.find((o) => o.kind === "half");
    return option
      ? [
          {
            option,
            urgent:
              !!item.scheduledFor && item.scheduledFor.getTime() <= Date.now() + 3 * MS_PER_DAY,
            reuse: false,
          },
        ]
      : [];
  });
  const asked = shape
    ? resolveAnytimeOption({ choice: { shape }, setup })
    : (setup.options.find((o) => o.kind === "full") ?? setup.options[0]);
  const targets = [
    ...scheduled,
    ...(asked
      ? [{ option: asked, urgent: !!shape, reuse: await canReuseMockItems(prisma, goal.userId) }]
      : []),
  ];
  const used = new Set<string>();
  const writes: MockFormatShortfall[] = [];
  const short = [];
  for (const target of targets) {
    const { option, reuse } = target;
    const planned = await planFromBank({
      goal,
      option,
      setup,
      userId: goal.userId,
      reuse,
      exclude: used,
    });
    if (!isCompleteMock({ option, setup, plan: planned.plan })) {
      short.push({
        urgent: target.urgent,
        listening: listMissingRecordings({ option, setup }).length > 0,
      });
      const batch = await planMockWrites({ goal, option, setup, userId: goal.userId, planned });
      writes.push(...(batch ?? []));
    }
    for (const id of getPlannedItemIds(planned.plan)) used.add(id);
  }
  return {
    quickFormat: getPlacementQuickFormat(setup.structure),
    writes,
    listening: short.some((s) => s.listening),
    urgentShort: short.some((s) => s.urgent),
  };
}

/** Internal workflow bridge: the goal must come from the public boundary that created it. */
export async function loadMockWritingSkills({
  goalId,
  skillIds,
}: {
  goalId: string;
  skillIds: readonly string[];
}): Promise<PlacementItemSkill[]> {
  const [goal, rows] = await Promise.all([
    prisma.goal.findUnique({ select: { examBlueprint: true }, where: { id: goalId } }),
    prisma.skill.findMany({
      select: {
        country: true,
        description: true,
        id: true,
        language: true,
        level: true,
        name: true,
        ownerId: true,
        targetLanguage: true,
      },
      where: { id: { in: [...skillIds] } },
    }),
  ]);

  const blueprint = goal?.examBlueprint ?? null;
  const exam = blueprint ? toItemExam(blueprint) : null;

  const usedSituations = await loadUsedSituations({
    includeMockReserve: true,
    examBlueprintId: blueprint?.id,
    skillIds,
  });

  return Promise.all(
    skillIds
      .flatMap((id) => rows.find((row) => row.id === id) ?? [])
      .map(async (skill) => {
        const pastQuestions = blueprint
          ? await listPastQuestionExamples({ examBlueprintId: blueprint.id, skillIds: [skill.id] })
          : [];

        return {
          ...skill,
          exam: exam && { ...exam, pastQuestions },
          usedSituations: usedSituations.get(skill.id) ?? [],
        };
      }),
  );
}

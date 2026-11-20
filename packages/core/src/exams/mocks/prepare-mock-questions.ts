import { captureMessage } from "@sentry/nextjs";
import { DbNull, type Goal, prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { findActiveSubscriptionForUser } from "../../auth/subscription";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLearnerModelCacheTag } from "../../cache/tags";
import {
  type PlacementQuickFormat,
  getPlacementQuickFormat,
} from "../../learner/placement/placement-quick-format";
import "server-only";
import { toListeningExam } from "../listening/listening-exam";
import { type PartsToPrepare } from "../listening/prepare-listening-part";
import {
  listMissingRecordings,
  loadAnytimeMockSetup,
  resolveAnytimeOption,
} from "./_utils/anytime-mock-setup";
import { canReuseMockItems, isCompleteMock, planFromBank } from "./_utils/create-anytime-mock";
import { planMockWrites } from "./_utils/mock-writes";
import { planScheduledFromBank } from "./_utils/plan-from-bank";
import {
  SCHEDULED_SUPPLY_PLAN_SELECT,
  listScheduledSupplyOptions,
} from "./_utils/scheduled-supply-options";
import { mockShapeSchema } from "./mock-contract";
import { getPlannedItemIds } from "./mock-plan";
import { type MockFormatShortfall } from "./mock-shortfall";

export type MockQuestionWrites = {
  recordings?: PartsToPrepare;
  allowStimulusSets?: boolean;
  learnerWaiting?: boolean;
  urgentShort?: boolean;
  quickFormat: PlacementQuickFormat;
  writes: MockFormatShortfall[];
};

export async function listDueMockGoals() {
  const now = new Date();

  const due = await prisma.goal.findMany({
    select: { examBlueprintId: true, id: true },
    where: {
      OR: [
        { requestedMock: { not: DbNull } },
        {
          plan: {
            items: {
              some: {
                kind: "mock",
                scheduledFor: { lte: new Date(now.getTime() + 7 * MS_PER_DAY) },
                status: "todo",
              },
            },
          },
        },
      ],
      kind: "exam",
      status: "active",
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
      OR: [
        { requestedMock: { not: DbNull } },
        { plan: { items: { some: { kind: "mock", status: "todo" } } } },
      ],
      examBlueprintId,
      id: { not: goalId },
      kind: "exam",
      status: "active",
    },
  });

  return [goalId, ...peers.map((peer) => peer.id)];
}

export async function checkMockSupply(goalId: string) {
  const [result, goal] = await Promise.all([
    listMockPrepWrites({ goalId }),
    prisma.goal.findUnique({ select: { userId: true }, where: { id: goalId } }),
  ]);

  if (goal) {
    revalidateCacheTags([getLearnerModelCacheTag(goal.userId)]);
  }

  if (result.urgentShort) {
    captureMessage("Mock exam questions are still short after preparation", {
      extra: { goalId },
      level: "warning",
    });
  }
}

async function getSupplyTargets({
  goal,
  setup,
}: {
  goal: Goal & { plan: Parameters<typeof listScheduledSupplyOptions>[0]["plan"] };
  setup: Awaited<ReturnType<typeof loadAnytimeMockSetup>>;
}) {
  const shape = mockShapeSchema.safeParse(goal.requestedMock).data;

  const upcoming = await listScheduledSupplyOptions({ goal, plan: goal.plan, setup });

  const scheduled = upcoming.map(({ option, scheduledFor }) => ({
    option,
    scheduledFor,
    reuse: false,
    urgent: scheduledFor.getTime() <= Date.now() + 3 * MS_PER_DAY,
  }));

  const asked = shape
    ? resolveAnytimeOption({ choice: { shape }, setup })
    : (setup.options.find((option) => option.kind === "full") ?? setup.options[0]);

  const reuseRequested = await canReuseMockItems(prisma, goal.userId);

  const targets = [
    ...scheduled,
    ...(asked && (shape || !reuseRequested)
      ? [{ option: asked, scheduledFor: null, reuse: reuseRequested, urgent: Boolean(shape) }]
      : []),
  ];

  return { learnerWaiting: Boolean(shape) && !reuseRequested, reuseRequested, targets };
}

export async function listMockPrepWrites({
  goalId,
}: {
  goalId: string;
}): Promise<MockQuestionWrites> {
  const goal = await prisma.goal.findUnique({
    include: { plan: { select: SCHEDULED_SUPPLY_PLAN_SELECT } },
    where: { id: goalId },
  });

  if (
    goal?.kind !== "exam" ||
    goal.status !== "active" ||
    !(await findActiveSubscriptionForUser({ now: new Date(), userId: goal.userId }))
  ) {
    return { quickFormat: "multipleChoice", writes: [] };
  }

  const setup = await loadAnytimeMockSetup(goal);
  const { learnerWaiting, reuseRequested, targets } = await getSupplyTargets({ goal, setup });
  const used = new Set<string>();
  const writes: MockFormatShortfall[] = [];
  let urgentShort = false;
  const missingParts: PartsToPrepare["parts"] = [];

  /* oxlint-disable no-await-in-loop -- Each target reserves the questions that later targets must exclude. */
  for (const target of targets) {
    const input = { goal, setup, option: target.option, exclude: used, userId: goal.userId };
    const scheduled =
      target.scheduledFor &&
      (await planScheduledFromBank({
        ...input,
        paperPlan: goal.plan,
        scheduledFor: target.scheduledFor,
      }));
    const planned = scheduled ?? (await planFromBank({ ...input, reuse: target.reuse }));
    const option = scheduled?.option ?? target.option;
    const complete =
      scheduled?.complete ??
      isCompleteMock({ option, plan: planned.plan, setup: planned.available });

    if (!complete) {
      const sections = listMissingRecordings({ option, setup: planned.available });

      missingParts.push(
        ...planned.available.missingParts.filter((part) => sections.includes(part.sectionName)),
      );

      urgentShort ||= target.urgent;

      const batch = await planMockWrites({
        goal,
        option,
        planned,
        skillIds: scheduled?.skillIds,
        setup: planned.available,
        userId: goal.userId,
      });
      writes.push(...(batch ?? []));
    }

    for (const id of getPlannedItemIds(planned.plan)) {
      used.add(id);
    }
  }

  /* oxlint-enable no-await-in-loop */

  const exam = toListeningExam({ ...goal, examBlueprint: setup.blueprint });

  return {
    ...(learnerWaiting && { learnerWaiting }),
    ...(writes.length > 0 && !reuseRequested && { allowStimulusSets: true }),
    ...(exam && missingParts.length > 0 && { recordings: { exam, parts: missingParts } }),
    quickFormat: getPlacementQuickFormat(setup.structure),
    urgentShort,
    writes,
  };
}

export { pickMockSetTargets } from "./mock-set-targets";
export { type MockWritingSkill, loadMockWritingSkills } from "./mock-writing-skills";

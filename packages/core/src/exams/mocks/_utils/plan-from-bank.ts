import "server-only";
import { type Goal, type TransactionClient, prisma } from "@zoonk/db";
import { loadGoalPlan } from "../../../learner/_utils/goal-skill-graph";
import { getMockFormatMix } from "../mock-format-mix";
import { planOptionMock } from "../mock-option-plan";
import { type MockOption } from "../mock-options";
import {
  type MockCandidate,
  type MockPlan,
  countPlannedQuestions,
  getPlannedItemIds,
} from "../mock-plan";
import { countReused } from "../mock-reuse";
import { hasMockWriting, outlineWrittenPrompts } from "../written-test-plan";
import { type AnytimeMockSetup, loadMockSkillIds } from "./anytime-mock-setup";
import { loadMockCandidates } from "./mock-candidates";
import { isScheduledPaperComplete } from "./mock-complete";
import { loadListeningCandidates } from "./mock-listening";
import { planWeeklyMock } from "./plan-weekly-mock";
import { readScheduledStructure } from "./read-mock-structure";
import {
  SCHEDULED_SUPPLY_PLAN_SELECT,
  listScheduledSupplyOptions,
} from "./scheduled-supply-options";

type BankPlan = {
  candidates: MockCandidate[];
  plan: MockPlan;
  available: AnytimeMockSetup;
  reuse: boolean;
};

type MockBank = {
  client: TransactionClient;
  exclude: ReadonlySet<string>;
  goalId: string;
  setup: AnytimeMockSetup;
  userId: string;
  reuse?: boolean;
  now?: Date;
};

async function loadAvailableSetup({
  client,
  exclude,
  goalId,
  reuse,
  now,
  setup,
  userId,
}: MockBank) {
  if (setup.missingParts.length === 0 && setup.listening.size === 0) {
    return setup;
  }

  const audio = await loadListeningCandidates({
    client,
    exclude: [...exclude],
    goalId,
    mix: getMockFormatMix(setup.structure),
    now,
    reuse,
    userId,
  });

  return {
    ...setup,
    listening: audio.recordings,
    missingParts: audio.missingParts,
    unvoiced: audio.unvoiced,
  };
}

function toScheduledShape(plan: Pick<MockPlan, "day" | "fullLength">) {
  return { day: plan.day, kind: plan.fullLength ? ("full" as const) : ("half" as const) };
}

export async function planScheduledFromBank({
  client = prisma,
  exclude,
  goal,
  identity,
  finishedMocks,
  paperPlan,
  scheduledFor,
  now,
  setup,
}: {
  client?: TransactionClient;
  exclude: ReadonlySet<string>;
  goal: Goal;
  identity: Parameters<typeof planWeeklyMock>[0]["identity"];
  finishedMocks: number;
  paperPlan: { graph: unknown; settings: unknown } | null;
  scheduledFor: Date;
  now?: Date;
  setup: AnytimeMockSetup;
}) {
  const structure = readScheduledStructure({
    blueprint: setup.blueprint,
    date: scheduledFor,
    goal,
    settings: paperPlan?.settings,
  });

  const goalPlan = await loadGoalPlan(goal.id, undefined, { tx: client });

  const plan = await planWeeklyMock({
    client,
    exclude,
    finishedMocks: Promise.resolve(finishedMocks),
    goal,
    graph: paperPlan?.graph,
    identity,
    now,
    skillIds: goalPlan.skills.map((skill) => skill.id),
    structure,
    today: scheduledFor,
    userId: goal.userId,
  });

  return {
    available: {
      ...setup,
      listening: plan.audio.recordings,
      missingParts: plan.audio.missingParts,
      structure,
      unvoiced: plan.audio.unvoiced,
    },
    candidates: plan.candidates,
    complete: isScheduledPaperComplete(
      plan,
      hasMockWriting({ essays: setup.essays, shape: toScheduledShape(plan), structure }),
    ),
    option: {
      area: null,
      areas: [],
      ...toScheduledShape(plan),
      questions: countPlannedQuestions(plan.outline),
    },
    plan,
    reuse: false,
  };
}

async function reserveScheduled({
  client,
  goal,
  setup,
  now,
}: {
  now?: Date;
  client: TransactionClient;
  goal: Goal;
  setup: AnytimeMockSetup;
}) {
  const plan = await client.plan.findUnique({
    select: SCHEDULED_SUPPLY_PLAN_SELECT,
    where: { goalId: goal.id },
  });

  const reserved = new Set<string>();
  const scheduled = await listScheduledSupplyOptions({ client, goal, plan });

  for (const paper of scheduled) {
    // oxlint-disable-next-line no-await-in-loop -- Each paper draws from what the previous paper left.
    const planned = await planScheduledFromBank({
      client,
      exclude: reserved,
      goal,
      ...paper,
      now,
      paperPlan: plan,
      setup,
    });

    for (const id of getPlannedItemIds(planned.plan)) {
      reserved.add(id);
    }
  }

  return reserved;
}

type BankInput = {
  goal: Goal;
  setup: AnytimeMockSetup;
  userId: string;
  client?: TransactionClient;
  reuse?: boolean;
  now?: Date;
  exclude?: ReadonlySet<string>;
};

export async function planFromBank({
  option,
  ...input
}: BankInput & { option: MockOption }): Promise<BankPlan> {
  // The written test sits only written questions, so it reads nothing from the reserve.
  const bank =
    option.kind === "written"
      ? { available: input.setup, reuse: input.reuse ?? false, text: [] }
      : await loadMockBank(input);

  return planFromMockBank({ bank, option });
}

export async function loadMockBank({
  client = prisma,
  now,
  reuse = false,
  exclude,
  goal,
  setup,
  userId,
}: BankInput) {
  const loaded = await loadMockCandidates({
    client,
    goal,
    itemIds: null,
    now,
    reuse,
    skillIds: await loadMockSkillIds(goal.id),
    structure: setup.structure,
    userId,
  });

  const protectedIds = exclude ?? (await reserveScheduled({ client, goal, now, setup }));

  const available =
    reuse || protectedIds.size > 0 || client !== prisma
      ? await loadAvailableSetup({
          client,
          exclude: protectedIds,
          goalId: goal.id,
          now,
          reuse,
          setup,
          userId,
        })
      : setup;

  return { available, reuse, text: loaded.filter((item) => !protectedIds.has(item.itemId)) };
}

export function planFromMockBank({
  bank,
  option,
}: {
  bank: Awaited<ReturnType<typeof loadMockBank>>;
  option: MockOption;
}): BankPlan {
  const { available, reuse, text } = bank;
  const candidates = [...text, ...[...available.listening.values()].flat()];

  const paper = {
    ...available,
    essays: outlineWrittenPrompts({ day: option.day, structure: available.structure }),
    option,
  };

  const freshPlan = planOptionMock({ ...paper, candidates: text.filter((item) => !item.answered) });

  if (!reuse || countPlannedQuestions(freshPlan) === option.questions) {
    return {
      available,
      candidates,
      plan: { ...freshPlan, reused: countReused({ candidates, sections: freshPlan.sections }) },
      reuse,
    };
  }
  // The full-day planner normally excludes repeats. Fair use admits them after reserving the scheduled papers.
  const plan = planOptionMock({
    ...paper,
    candidates: text.map((item) => ({ ...item, answered: false })),
  });

  return {
    available,
    candidates,
    plan: { ...plan, reused: countReused({ candidates, sections: plan.sections }) },
    reuse,
  };
}

import "server-only";
import { type Goal, type TransactionClient, prisma } from "@zoonk/db";
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
import { type AnytimeMockSetup, loadMockSkillIds } from "./anytime-mock-setup";
import { loadMockCandidates } from "./mock-candidates";
import { loadListeningCandidates } from "./mock-listening";
import { listScheduledSupplyOptions } from "./scheduled-supply-options";

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
};

async function loadAvailableSetup({ client, exclude, goalId, setup, userId }: MockBank) {
  if (setup.missingParts.length === 0 && setup.listening.size === 0) {
    return setup;
  }

  const audio = await loadListeningCandidates({
    client,
    exclude: [...exclude],
    goalId,
    mix: getMockFormatMix(setup.structure),
    userId,
  });

  return {
    ...setup,
    listening: audio.recordings,
    missingParts: audio.missingParts,
    unvoiced: audio.unvoiced,
  };
}

async function reserveScheduled({
  candidates,
  client,
  goal,
  setup,
  userId,
}: {
  candidates: readonly MockCandidate[];
  client: TransactionClient;
  goal: Goal;
  setup: AnytimeMockSetup;
  userId: string;
}) {
  const plan = await client.plan.findUnique({
    select: {
      items: {
        orderBy: { scheduledFor: "asc" },
        select: { scheduledFor: true },
        take: 2,
        where: { kind: "mock", status: "todo" },
      },
      phases: true,
      settings: true,
    },
    where: { goalId: goal.id },
  });

  const reserved = new Set<string>();
  const scheduled = await listScheduledSupplyOptions({ client, goal, plan, setup });

  for (const { option } of scheduled) {
    // eslint-disable-next-line no-await-in-loop -- Each paper subtracts the recordings held for the one before it.
    const available = await loadAvailableSetup({
      client,
      exclude: reserved,
      goalId: goal.id,
      setup,
      userId,
    });

    const planned = planOptionMock({
      ...available,
      candidates: candidates.filter((item) => !item.answered && !reserved.has(item.itemId)),
      option,
    });

    for (const id of getPlannedItemIds(planned)) {
      reserved.add(id);
    }
  }

  return reserved;
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
}): Promise<BankPlan> {
  const loaded = await loadMockCandidates({
    client,
    goal,
    itemIds: null,
    reuse,
    skillIds: await loadMockSkillIds(goal.id),
    structure: setup.structure,
    userId,
  });

  const protectedIds =
    exclude ??
    (reuse
      ? await reserveScheduled({ candidates: loaded, client, goal, setup, userId })
      : new Set<string>());

  const available =
    protectedIds.size > 0 || client !== prisma
      ? await loadAvailableSetup({ client, exclude: protectedIds, goalId: goal.id, setup, userId })
      : setup;

  const candidates = loaded.filter((item) => !protectedIds.has(item.itemId));

  const freshPlan = planOptionMock({
    ...available,
    candidates: candidates.filter((item) => !item.answered),
    option,
  });

  if (!reuse || countPlannedQuestions(freshPlan) === option.questions) {
    return { available, candidates, plan: freshPlan, reuse };
  }
  // The full-day planner normally excludes repeats. Fair use admits them after reserving the scheduled papers.
  const plan = planOptionMock({
    ...available,
    candidates: candidates.map((item) => ({ ...item, answered: false })),
    option,
  });

  return {
    available,
    candidates,
    plan: { ...plan, reused: countReused({ candidates, sections: plan.sections }) },
    reuse,
  };
}

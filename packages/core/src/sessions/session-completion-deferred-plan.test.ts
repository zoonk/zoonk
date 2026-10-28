import { prisma } from "@zoonk/db";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { after } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { markLearnerChanged } from "../learner/_utils/mark-learner-changed";
import * as milestones from "../milestones/award-milestones";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import * as replan from "../plans/_utils/replan";
import { createGoalPlan } from "../plans/create-goal-plan";
import { getGoalPlan } from "../plans/get-goal-plan";
import * as refresh from "../plans/refresh-goal-plan";
import { answerStudyQuestion } from "./answer-study-question";
import { toBlockPayload } from "./block-payload";
import { finishStudyBlock } from "./finish-study-block";
import { startStudyBlock } from "./start-study-block";
import { stopStudySession } from "./stop-study-session";

/** Observe real refresh calls; only Next's request-lifetime boundary is held by the test. */
function holdDeferredWork() {
  const work: Parameters<typeof after>[0][] = [];
  vi.mocked(after).mockImplementation((task) => work.push(task));

  return {
    clear: () => {
      void work.splice(0);
    },
    run: async () => {
      await Promise.all(work.splice(0).map((task) => (typeof task === "function" ? task() : task)));
    },
  };
}

async function finishPractice({
  goalId,
  itemId,
  skillId,
  userId,
}: {
  goalId?: string;
  itemId: string;
  skillId: string;
  userId: string;
}) {
  const session = await studySessionFixture({ goalId, plannedMinutes: 3, userId });

  const block = await studySessionBlockFixture({
    estimatedMinutes: 3,
    kind: "practice",
    payload: toBlockPayload({ itemIds: [itemId], skillIds: [skillId] }),
    sessionId: session.id,
  });

  await startStudyBlock({ blockId: block.id, input: { timeZone: "UTC" }, sessionId: session.id });

  await answerStudyQuestion({
    blockId: block.id,
    input: { answer: { selectedIndex: 0 }, durationMs: 1000, itemId, timeZone: "UTC" },
    sessionId: session.id,
  });

  return { block, session };
}

function readPlan(planId: string) {
  return prisma.plan.findUniqueOrThrow({
    include: { changes: { orderBy: { id: "asc" } }, items: { orderBy: { position: "asc" } } },
    where: { id: planId },
  });
}

async function plannedPractice() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-28T12:00:00Z"));

  const [user, library] = await Promise.all([
    userFixture(),
    planLibraryFixture({ skills: [{ lessons: 8 }] }),
  ]);

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 10,
    details: { placementDeclined: true },
    settings: { startDate: "2026-09-28" },
    targetDate: new Date("2026-10-30"),
    timezone: "UTC",
    userId: user.id,
  });

  mockSession(user.id);

  await expect(createGoalPlan({ goalId: goal.id, graph: library.graph })).resolves.toMatchObject({
    status: "created",
  });

  vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
  const skillId = library.skills[0]?.id ?? "";
  const item = await itemFixture({ content: choiceItemContent(), skillId });

  const practice = await finishPractice({
    goalId: goal.id,
    itemId: item.id,
    skillId,
    userId: user.id,
  });

  return { ...practice, goal, plan, user };
}

describe("session completion awaits its saved plan", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(after).mockReset();
    vi.useRealTimers();
  });

  it("closes a goalless session and its ledger before returning", async () => {
    const deferred = holdDeferredWork();
    const [user, skill] = await Promise.all([userFixture(), skillFixture()]);
    const item = await itemFixture({ content: choiceItemContent(), skillId: skill.id });
    mockSession(user.id);

    const { block, session } = await finishPractice({
      itemId: item.id,
      skillId: skill.id,
      userId: user.id,
    });

    deferred.clear();

    await expect(
      finishStudyBlock({ blockId: block.id, input: { timeZone: "UTC" }, sessionId: session.id }),
    ).resolves.toMatchObject({ completion: { sessionCompleted: true }, status: "ready" });

    const saved = await prisma.studySession.findUniqueOrThrow({ where: { id: session.id } });
    expect(saved.status).toBe("completed");
    expect(saved.endSnapshot).not.toBeNull();

    const ledger = await prisma.learningEvent.findFirstOrThrow({
      where: {
        contentIds: { equals: session.id, path: ["studySessionId"] },
        kind: "session",
        userId: user.id,
      },
    });

    expect(ledger.endedAt).toStrictEqual(saved.endedAt);
  });

  it("still finishes and awards milestones when its awaited plan refresh fails", async () => {
    holdDeferredWork();
    const { block, session } = await plannedPractice();
    vi.spyOn(refresh, "refreshGoalPlan").mockRejectedValue(new Error("Planning unavailable"));
    const award = vi.spyOn(milestones, "awardMilestones");

    await expect(
      finishStudyBlock({ blockId: block.id, input: { timeZone: "UTC" }, sessionId: session.id }),
    ).resolves.toMatchObject({ completion: { sessionCompleted: true }, status: "ready" });

    expect(award).toHaveBeenCalledOnce();

    await expect(
      prisma.studySession.findUniqueOrThrow({ where: { id: session.id } }),
    ).resolves.toMatchObject({ status: "completed" });
  });

  it("awaits the plan on the first stop, once, while unfinished work stays", async () => {
    holdDeferredWork();
    const { session } = await plannedPractice();
    await studySessionBlockFixture({ kind: "learn", position: 1, sessionId: session.id });
    const renew = vi.spyOn(refresh, "refreshGoalPlan");

    await expect(
      stopStudySession({ input: { timeZone: "UTC" }, sessionId: session.id }),
    ).resolves.toMatchObject({ status: "ready" });

    expect(renew).toHaveBeenCalledOnce();
    await stopStudySession({ input: { timeZone: "UTC" }, sessionId: session.id });
    expect(renew).toHaveBeenCalledOnce();
  });

  it("returns only after items, summary and proposals have been saved", async () => {
    const deferred = holdDeferredWork();
    const { block, goal, plan, session } = await plannedPractice();
    const before = await readPlan(plan.id);
    deferred.clear();

    await expect(
      finishStudyBlock({ blockId: block.id, input: { timeZone: "UTC" }, sessionId: session.id }),
    ).resolves.toMatchObject({ completion: { sessionCompleted: true }, status: "ready" });

    const saved = await readPlan(plan.id);
    expect(saved.version).toBeGreaterThan(before.version);

    expect(saved.summary).toMatchObject({
      advice: expect.any(Object),
      basis: { layoutInputVersion: saved.inputVersion, planVersion: saved.version },
    });

    for (const proposal of saved.changes.filter((change) => change.status === "proposed")) {
      expect(proposal.payload).toMatchObject({
        previewBasis: {
          inputVersion: saved.inputVersion,
          planVersion: saved.version,
          studyDay: "2026-09-30",
        },
      });
    }

    const change = saved.changes.findLast(
      (entry) => entry.kind === "missedDays" && entry.status === "applied",
    );

    expect(change).toBeDefined();
    const read = await getGoalPlan(goal.id);

    expect(read.status === "ready" && read.plan.changes.map((entry) => entry.id)).toContain(
      change?.id,
    );

    await expect(readPlan(plan.id)).resolves.toStrictEqual(saved);
  });

  it("retries a concurrent calendar change before reporting completion", async () => {
    holdDeferredWork();
    const { block, goal, plan, session, user } = await plannedPractice();
    const compute = replan.computePlan;
    // Only pause the real computation's return; both competing writes use the real database.
    vi.spyOn(replan, "computePlan").mockImplementationOnce((async (input) => {
      const computed = await compute(input);

      await prisma.$transaction(async (tx) => {
        await markLearnerChanged(tx, { planInputs: true, userId: user.id });
        await tx.goal.update({ data: { dailyMinutes: 20 }, where: { id: goal.id } });
      });

      return computed;
    }) as typeof compute);

    await expect(
      finishStudyBlock({ blockId: block.id, input: { timeZone: "UTC" }, sessionId: session.id }),
    ).resolves.toMatchObject({ completion: { sessionCompleted: true }, status: "ready" });

    const saved = await readPlan(plan.id);
    expect(saved.summary).toMatchObject({ basis: { layoutInputVersion: saved.inputVersion } });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      dailyMinutes: 20,
    });
  });
});

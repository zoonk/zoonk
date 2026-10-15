import { prisma } from "@zoonk/db";
import { studySessionBlockFixture } from "@zoonk/testing/fixtures/study-sessions";
import { after } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as deferredWork from "../_test-utils/deferred-work";
import { getBlockItemIds, readBlockPayload } from "../sessions/block-payload";
import * as blockFinish from "../sessions/finish-study-block";
import { getStudySession } from "../sessions/get-study-session";
import * as sessionStop from "../sessions/stop-study-session";
import { runSimLifeInDb } from "./_test-utils/sim/sim-db";
import * as simReads from "./_test-utils/sim/sim-db-reads";
import * as simRunner from "./_test-utils/sim/sim-db-runner";
import * as simToday from "./_test-utils/sim/sim-db-today";
import { type SimLife } from "./_test-utils/sim/sim-life-plan";
import * as planRefresh from "./refresh-goal-plan";

const START = "2020-09-28";

/**
 * Next's response work may remain pending until its request is joined. Give each registered
 * callback its own gate, released only by the collector that owns it. A collector already drained
 * by an earlier answer cannot accidentally make a later completion synchronous. Real callbacks,
 * including the planner's database writes, still run when their owner drains them.
 */
function observeDeferredWork(isCompletion: () => boolean) {
  const run = deferredWork.runDeferredWork;
  const pending = new Set<symbol>();

  vi.spyOn(deferredWork, "runDeferredWork").mockImplementation(() => {
    const drain = run();
    const collect = vi.mocked(after).getMockImplementation();
    const releases = new Set<VoidFunction>();

    if (!collect) {
      throw new Error("Expected the request's deferred-work collector");
    }

    vi.mocked(after).mockImplementation((task) => {
      if (!isCompletion()) {
        collect(task);
        return;
      }

      const gate = Promise.withResolvers<null>();
      const token = Symbol("pending response work");
      pending.add(token);
      releases.add(() => gate.resolve(null));

      collect(async () => {
        await gate.promise;

        try {
          await (typeof task === "function" ? task() : task);
        } finally {
          pending.delete(token);
        }
      });
    });

    return async () => {
      const ready = [...releases];
      releases.clear();
      ready.forEach((release) => release());
      await drain();
    };
  });

  return pending;
}

/** Observe completion/stop response work; block-start analytics do not mutate the plan. */
function observeCompletionWork() {
  const boundary = { active: false };
  const finish = blockFinish.finishStudyBlock;
  const stop = sessionStop.stopStudySession;

  vi.spyOn(blockFinish, "finishStudyBlock").mockImplementation(async (input) => {
    const previous = boundary.active;
    boundary.active = true;

    try {
      return await finish(input);
    } finally {
      boundary.active = previous;
    }
  });

  vi.spyOn(sessionStop, "stopStudySession").mockImplementation(async (input) => {
    const previous = boundary.active;
    boundary.active = true;

    try {
      return await stop(input);
    } finally {
      boundary.active = previous;
    }
  });

  return observeDeferredWork(() => boundary.active);
}

function life(finish: number): SimLife {
  return {
    dailyMinutes: 15,
    fixture: "class-test",
    knownAreas: [],
    pending: [],
    seed: 2107,
    speed: 1,
    start: START,
    steps: [
      { finish, kind: "study", misses: [] },
      { kind: "change", spec: { kind: "time", minutes: 30 }, via: "buddy" },
    ],
    subscribed: false,
    targetInDays: 35,
  };
}

describe("question-enabled simulator response boundaries", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${START}T12:00:00Z`));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it.each([
    {
      finish: 1,
      label: "completed",
      lastKinds: ["practice"],
      refreshes: [START],
      sessionState: { endedAt: expect.any(Date), status: "completed" },
    },
    {
      finish: 0.5,
      label: "partially stopped",
      lastKinds: ["practice", "review", "learn"],
      refreshes: [],
      sessionState: { endedAt: null, status: "active", stoppedAt: expect.any(Date) },
    },
  ])(
    "settles the $label question session before its snapshot and next day",
    async ({ finish, lastKinds, refreshes, sessionState }) => {
      const pending = observeCompletionWork();
      const startRunner = simRunner.startDbRunner;
      const record = simRunner.recordDb;
      const setToday = simReads.setSimToday;
      const open = simToday.openTodayDb;
      const refresh = planRefresh.refreshGoalPlan;
      const settledRefreshes: string[] = [];
      const snapshots: string[] = [];

      vi.spyOn(simRunner, "startDbRunner").mockImplementation(async (input) => {
        const runner = await startRunner(input);

        /** This fixture tests response ownership; learner memory is off, so no model can run. */
        await prisma.userLearningProfile.update({
          data: { memoryEnabled: false },
          where: { userId: runner.goal.userId },
        });

        return runner;
      });

      vi.spyOn(planRefresh, "refreshGoalPlan").mockImplementation(async (input) => {
        const result = await refresh(input);

        if (input.pace === "sampled") {
          settledRefreshes.push(new Date().toISOString().slice(0, 10));
        }

        return result;
      });

      vi.spyOn(simToday, "openTodayDb").mockImplementation(async (runner, index) => {
        const session = await open(runner, index);

        if (index !== 0 || !session || sessionState.status !== "completed") {
          return session;
        }

        const blocks = await prisma.studySessionBlock.findMany({
          where: { sessionId: session.id },
        });

        const asked = blocks.flatMap((block) => getBlockItemIds(readBlockPayload(block)));

        const item = await prisma.item.findFirstOrThrow({
          orderBy: { id: "asc" },
          where: {
            id: { notIn: asked },
            skillId: { in: runner.library.graph.skills.map((skill) => skill.skillId) },
          },
        });

        /** A test-owned pending practice block makes the final response a question, independent of layout. */
        await studySessionBlockFixture({
          estimatedMinutes: 1,
          kind: "practice",
          payload: { itemIds: [item.id], skillIds: [item.skillId] },
          position: Math.max(...blocks.map((block) => block.position)) + 1,
          sessionId: session.id,
        });

        const updated = await getStudySession({
          input: { timeZone: "UTC" },
          sessionId: session.id,
        });

        if (updated.status !== "ready") {
          throw new Error("Expected the learner's session with its terminal practice question");
        }

        return updated.session;
      });

      vi.spyOn(simReads, "setSimToday").mockImplementation((day) => {
        expect(pending.size, "response work escaped into another simulated day").toBe(0);
        setToday(day);
      });

      vi.spyOn(simRunner, "recordDb").mockImplementation(async (runner, step) => {
        if (step.label !== "session") {
          return record(runner, step);
        }

        const session = await prisma.studySession.findFirstOrThrow({
          include: { blocks: { orderBy: { position: "asc" } } },
          where: { goalId: runner.goal.id },
        });

        expect(session).toMatchObject(sessionState);

        await expect(
          prisma.attempt.count({ where: { studySessionId: session.id } }),
        ).resolves.toBeGreaterThan(0);

        const lastPlayed = session.blocks.findLast((block) => block.status === "completed");
        expect(lastKinds).toContain(lastPlayed?.kind);

        expect(pending.size, "response work escaped the session snapshot").toBe(0);
        expect(new Date().toISOString().slice(0, 10)).toBe(START);

        expect(settledRefreshes).toStrictEqual(refreshes);

        const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: runner.goal.id } });
        await record(runner, step);
        expect(runner.last?.version).toBe(plan.version);
        snapshots.push(session.id);
      });

      const result = await runSimLifeInDb(life(finish), {
        check: () => [],
        questions: true,
        rules: [],
      });

      expect(snapshots).toHaveLength(1);
      expect(result.events.some((event) => event.label === "change")).toBe(true);
      expect(pending.size).toBe(0);
    },
  );
});

import { type TransactionClient, prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { DAY_MS, SESSION_NOW, daysAgo } from "../../sessions/_test-utils/session-goal";
import { type MockConditions, type MockResult } from "../mocks/mock-contract";
import { loadExamHistory } from "./_utils/exam-history";
import { getExamView } from "./get-exam-view";

const MOCKS = 12;
const QUESTIONS = 20;

function observeHistoryQueries(observe: (client: TransactionClient) => () => void) {
  const restoreRoot = observe(prisma);
  const transaction = prisma.$transaction.bind(prisma);

  const transactions = vi.spyOn(prisma, "$transaction").mockImplementation((async (
    callback: Parameters<typeof prisma.$transaction>[0],
    options: Parameters<typeof prisma.$transaction>[1],
  ) =>
    transaction(async (client) => {
      /** Prisma transaction proxies inherit root methods; do not stack root hooks on them. */
      restoreRoot();
      const restore = observe(client);

      try {
        return await callback(client);
      } finally {
        restore();
      }
    }, options)) as typeof prisma.$transaction);

  return () => {
    transactions.mockRestore();
    restoreRoot();
  };
}

function netResult(correct: number): MockResult {
  return {
    areas: [],
    blank: 0,
    calibration: {
      advice: null,
      blankingGain: 1,
      sure: { answered: 2, right: 2 },
      unsure: { answered: 1, right: 0 },
    },
    coherence: null,
    correct,
    irt: null,
    minutesUsed: 30,
    net: {
      blank: 0,
      max: QUESTIONS,
      net: correct * 2 - QUESTIONS,
      partial: 0,
      penalty: 1,
      right: correct,
      wrong: 0,
    },
    plannedMinutes: 30,
    preparation: null,
    previous: null,
    scoring: "net",
    topics: [],
    total: QUESTIONS,
    unansweredAtTimeout: 0,
  };
}

async function historySetup(mocks = MOCKS) {
  const [user, blueprint] = await Promise.all([userFixture(), examBlueprintFixture()]);

  const [goal, otherGoal] = await Promise.all([
    goalFixture({ examBlueprintId: blueprint.id, kind: "exam", timezone: "UTC", userId: user.id }),
    goalFixture({ examBlueprintId: blueprint.id, kind: "exam", timezone: "UTC", userId: user.id }),
  ]);

  const finished = ({ goalId, index }: { goalId: string; index: number }) => {
    const createdAt = daysAgo((mocks - index) * 7);

    const result =
      index === 0 ? { ...netResult(5), calibration: null } : netResult(5 + (index % MOCKS));

    return {
      conditions: {},
      createdAt,
      finishedAt: new Date(createdAt.getTime() + DAY_MS),
      goalId,
      result,
      sectionStartedAt: createdAt,
      status: "finished" as const,
      userId: user.id,
    };
  };

  const weekly = Array.from({ length: mocks }, (_, index) => finished({ goalId: goal.id, index }));

  const left = { conditions: {}, createdAt: daysAgo(1), sectionStartedAt: daysAgo(1) };

  await Promise.all([
    prisma.mockExam.createMany({
      data: [
        ...weekly,
        { ...left, goalId: goal.id, status: "active", userId: user.id },
        finished({ goalId: otherGoal.id, index: 1 }),
      ],
    }),
    studySessionFixture({
      goalId: goal.id,
      localDate: daysAgo(2),
      startedAt: daysAgo(2),
      userId: user.id,
    }),
    studySessionFixture({
      goalId: goal.id,
      localDate: daysAgo(1),
      startedAt: daysAgo(1),
      userId: user.id,
    }),
    studySessionFixture({ goalId: goal.id, localDate: SESSION_NOW, userId: user.id }),
  ]);

  mockSession(user.id);
  return { goal };
}

describe("exam screen history", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lists the goal's latest finished mocks newest first, and adds up calibration across every one", async () => {
    const { goal } = await historySetup();
    const result = await getExamView({ goalId: goal.id });
    const exam = result.status === "ready" ? result.exam : null;

    expect(exam?.mocks).toHaveLength(10);

    expect(exam?.mocks.map((mock) => mock.number)).toStrictEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);

    expect(exam?.mocks[0]).toMatchObject({ correct: 16, measure: 12, scoring: "net", total: 20 });
    expect(exam?.sessionsDone).toBe(2);

    expect(exam?.calibration).toMatchObject({
      blankingGain: 11,
      sure: { answered: 22, right: 22 },
      unsure: { answered: 11, right: 0 },
    });
  });

  it("bounds snapshot reads while keeping lifetime numbering, calibration and recent progress", async () => {
    const { goal } = await historySetup(32);

    const snapshots: unknown[][] = [];

    const restore = observeHistoryQueries((client) => {
      const findMany = client.mockExam.findMany.bind(client.mockExam);

      const reads = vi.spyOn(client.mockExam, "findMany").mockImplementation((async (
        args: Parameters<typeof findMany>[0],
      ) => {
        const rows = await findMany(args);
        snapshots.push(rows);
        return rows;
      }) as typeof client.mockExam.findMany);

      return () => reads.mockRestore();
    });

    try {
      const history = await loadExamHistory({ goalId: goal.id, today: SESSION_NOW });
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0]).toHaveLength(20);

      expect(history.mocks.map((mock) => mock.number)).toStrictEqual([
        32, 31, 30, 29, 28, 27, 26, 25, 24, 23,
      ]);

      expect(history.progress?.mocks.map((mock) => mock.number)).toStrictEqual(
        Array.from({ length: 20 }, (_, index) => index + 13),
      );

      expect(history.calibration).toStrictEqual({
        advice: "blankUnsure",
        blankingGain: 31,
        sure: { answered: 62, right: 62 },
        unsure: { answered: 31, right: 0 },
      });
    } finally {
      restore();
    }
  });

  it("keeps numbering and calibration consistent when a mock completes between history reads", async () => {
    const { goal } = await historySetup(32);

    const pending = await prisma.mockExam.findFirstOrThrow({
      where: { goalId: goal.id, status: "active" },
    });

    const completed = Promise.withResolvers<null>();

    const restore = observeHistoryQueries((client) => {
      const findMany = client.mockExam.findMany.bind(client.mockExam);
      const count = client.mockExam.count.bind(client.mockExam);
      const queryRaw = client.$queryRaw.bind(client);

      const rows = vi.spyOn(client.mockExam, "findMany").mockImplementation((async (
        args: Parameters<typeof findMany>[0],
      ) => {
        const snapshots = await findMany(args);

        try {
          await prisma.mockExam.update({
            data: { finishedAt: SESSION_NOW, result: netResult(18), status: "finished" },
            where: { id: pending.id },
          });

          return snapshots;
        } finally {
          completed.resolve(null);
        }
      }) as typeof client.mockExam.findMany);

      const counts = vi.spyOn(client.mockExam, "count").mockImplementation((async (
        args: Parameters<typeof count>[0],
      ) => {
        await completed.promise;
        return count(args);
      }) as typeof client.mockExam.count);

      const calibration = vi.spyOn(client, "$queryRaw").mockImplementation((async (...args) => {
        await completed.promise;
        return queryRaw(...args);
      }) as typeof client.$queryRaw);

      return () => {
        rows.mockRestore();
        counts.mockRestore();
        calibration.mockRestore();
      };
    });

    try {
      const history = await loadExamHistory({ goalId: goal.id, today: SESSION_NOW });

      await expect(
        prisma.mockExam.count({ where: { goalId: goal.id, status: "finished" } }),
      ).resolves.toBe(33);

      expect(history.mocks.map((mock) => mock.number)).toStrictEqual([
        32, 31, 30, 29, 28, 27, 26, 25, 24, 23,
      ]);

      expect(history.progress?.mocks.map((mock) => mock.number)).toStrictEqual(
        Array.from({ length: 20 }, (_, index) => index + 13),
      );

      expect(history.calibration).toMatchObject({
        blankingGain: 31,
        sure: { answered: 62, right: 62 },
        unsure: { answered: 31, right: 0 },
      });
    } finally {
      restore();
    }

    const next = await loadExamHistory({ goalId: goal.id, today: SESSION_NOW });

    expect(next.mocks.map((mock) => mock.number)).toStrictEqual([
      33, 32, 31, 30, 29, 28, 27, 26, 25, 24,
    ]);

    expect(next.calibration).toMatchObject({
      blankingGain: 32,
      sure: { answered: 64, right: 64 },
      unsure: { answered: 32, right: 0 },
    });
  });

  it("uses the latest penalty for advice on the lifetime calibration", async () => {
    const { goal } = await historySetup(32);

    const result = {
      ...netResult(10),
      calibration: {
        advice: null,
        blankingGain: 1,
        sure: { answered: 2, right: 2 },
        unsure: { answered: 3, right: 1 },
      },
    };

    await prisma.mockExam.updateMany({
      data: { result },
      where: { goalId: goal.id, status: "finished" },
    });

    const latest = await prisma.mockExam.findFirstOrThrow({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      where: { goalId: goal.id, status: "finished" },
    });

    await prisma.mockExam.update({
      data: {
        result: {
          ...result,
          calibration: { ...result.calibration, blankingGain: -0.5 },
          net: {
            ...netResult(10).net,
            blank: 0,
            max: 20,
            net: 7.5,
            penalty: 0.25,
            right: 10,
            wrong: 10,
          },
        },
      },
      where: { id: latest.id },
    });

    const history = await loadExamHistory({ goalId: goal.id, today: SESSION_NOW });

    expect(history.calibration).toStrictEqual({
      advice: "keepAnswering",
      blankingGain: 30.5,
      sure: { answered: 64, right: 64 },
      unsure: { answered: 96, right: 32 },
    });
  });
});

function subjectResult(rightBySubject: Record<string, number>, perSubject = 16): MockResult {
  const subjects = Object.entries(rightBySubject);
  const correct = subjects.reduce((sum, [, right]) => sum + right, 0);

  return {
    ...netResult(correct),
    areas: subjects.map(([name, right]) => ({
      correct: right,
      name,
      score: null,
      secondsPerQuestion: 60,
      targetSecondsPerQuestion: null,
      total: perSubject,
    })),
    calibration: null,
    net: null,
    scoring: "raw",
    total: subjects.length * perSubject,
  };
}

function sat(
  attrs: Pick<MockConditions, "purpose" | "shape"> & { reused?: number },
): MockConditions {
  return {
    day: null,
    examQuestions: null,
    fullLength: false,
    partialCredit: "allOrNothing",
    reused: 0,
    scoring: "raw",
    sections: [],
    startTime: null,
    timeZone: null,
    timedOutSections: [],
    wrongPenalty: 1,
    ...attrs,
  };
}

async function progressSetup({ plus }: { plus: boolean }) {
  const [user, blueprint] = await Promise.all([userFixture(), examBlueprintFixture()]);

  const goal = await goalFixture({
    examBlueprintId: blueprint.id,
    kind: "exam",
    timezone: "UTC",
    userId: user.id,
  });

  const taken = [
    {
      conditions: sat({ purpose: "placement", shape: null }),
      result: subjectResult({ Languages: 8, Mathematics: 4 }),
    },
    {
      conditions: sat({
        purpose: "practice",
        shape: { area: "Mathematics", day: null, kind: "area" },
      }),
      result: subjectResult({ Mathematics: 8 }),
    },
    {
      conditions: sat({ purpose: "planned", shape: null }),
      result: subjectResult({ Languages: 8, Mathematics: 10 }),
    },
    {
      conditions: sat({ purpose: "practice", shape: { area: null, day: null, kind: "full" } }),
      result: subjectResult({ Languages: 6, Mathematics: 14 }),
    },
  ];

  await Promise.all([
    prisma.mockExam.createMany({
      data: taken.map((mock, index) => ({
        ...mock,
        createdAt: daysAgo((taken.length - index) * 7),
        finishedAt: daysAgo((taken.length - index) * 7),
        goalId: goal.id,
        sectionStartedAt: daysAgo((taken.length - index) * 7),
        status: "finished" as const,
        userId: user.id,
      })),
    }),
    plus
      ? prisma.subscription.create({
          data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
        })
      : null,
  ]);

  mockSession(user.id);
  return { goal, user };
}

describe("progress across mocks", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows each mock's share right over time, each subject's trend, what improved and what needs work", async () => {
    const { goal } = await progressSetup({ plus: true });
    const result = await getExamView({ goalId: goal.id });
    const exam = result.status === "ready" ? result.exam : null;

    expect(exam?.progress?.mocks).toStrictEqual([
      expect.objectContaining({ number: 1, percent: 38, purpose: "placement" }),
      expect.objectContaining({
        number: 2,
        percent: 50,
        shape: expect.objectContaining({ kind: "area" }),
      }),
      expect.objectContaining({ number: 3, percent: 56, purpose: "planned" }),
      expect.objectContaining({
        number: 4,
        percent: 63,
        shape: expect.objectContaining({ kind: "full" }),
      }),
    ]);

    expect(exam?.progress?.subjects).toStrictEqual([
      { change: -12, name: "Languages", percents: [50, 50, 38] },
      { change: 63, name: "Mathematics", percents: [25, 50, 63, 88] },
    ]);

    expect(exam?.progress).toMatchObject({ improved: ["Mathematics"], needsWork: ["Languages"] });
  });

  it("draws no trend from too little evidence: few questions of a subject, or a mostly repeated mock", async () => {
    const { goal, user } = await progressSetup({ plus: true });
    const ethics = { area: "Ética", day: null, kind: "area" } as const;
    const law = { area: "Civil Law", day: null, kind: "area" } as const;

    const later = [
      {
        conditions: sat({ purpose: "practice", shape: ethics }),
        result: subjectResult({ Ética: 4 }, 8),
      },
      {
        conditions: sat({ purpose: "practice", reused: 7, shape: ethics }),
        result: subjectResult({ Ética: 5 }, 8),
      },
      {
        conditions: sat({ purpose: "practice", shape: law }),
        result: subjectResult({ "Civil Law": 8 }, 20),
      },
      {
        conditions: sat({ purpose: "practice", reused: 15, shape: law }),
        result: subjectResult({ "Civil Law": 18 }, 20),
      },
    ];

    await prisma.mockExam.createMany({
      data: later.map((mock, index) => ({
        ...mock,
        createdAt: daysAgo(3 - index * 0.5),
        finishedAt: daysAgo(3 - index * 0.5),
        goalId: goal.id,
        sectionStartedAt: daysAgo(3 - index * 0.5),
        status: "finished" as const,
        userId: user.id,
      })),
    });

    const result = await getExamView({ goalId: goal.id });
    const progress = result.status === "ready" ? result.exam.progress : null;

    expect(progress?.mocks).toHaveLength(8);
    expect(progress?.subjects.find((trend) => trend.name === "Ética")).toBeUndefined();

    expect(progress?.subjects.find((trend) => trend.name === "Civil Law")).toMatchObject({
      change: null,
      percents: [40],
    });

    expect(progress?.improved).not.toContain("Ética");
    expect(progress?.improved).not.toContain("Civil Law");
  });

  it("is a Plus feature: the free plan keeps its list of mocks and sees the progress locked", async () => {
    const { goal } = await progressSetup({ plus: false });
    const result = await getExamView({ goalId: goal.id });

    expect(result).toMatchObject({ exam: { mocksRequirePlus: true, progress: null } });
    expect(result.status === "ready" && result.exam.mocks).toHaveLength(4);
  });
});

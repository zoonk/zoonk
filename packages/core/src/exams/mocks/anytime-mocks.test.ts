import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { analytics } from "../../_test-utils/test-boundaries";
import { parsePlanGraph } from "../../plans/planner/plan-state";
import { SESSION_NOW, daysAgo } from "../../sessions/_test-utils/session-goal";
import { scheduledMockSetup } from "./_test-utils/scheduled-mock";
import { mockPaperKey } from "./_utils/mock-supply-request";
import { adaptPlanFromMock } from "./adapt-plan-from-mock";
import { finishMock } from "./finish-mock";
import { getMock } from "./get-mock";
import { getMockOptions } from "./get-mock-options";
import { type MockShape, type MockView, mockConditionsSchema } from "./mock-contract";
import { checkMockSupply, listDueMockGoals, listMockPrepWrites } from "./prepare-mock-questions";
import { saveMockAnswer } from "./save-mock-answer";
import { startAnytimeMock } from "./start-anytime-mock";
import { startMock } from "./start-mock";

const CITATION = { passage: "From the notice.", sourceId: "source" };
const AREAS = ["Mathematics", "Languages"] as const;
const SKILLS_PER_AREA = 2;
const UTC = "UTC";

const STRUCTURE = {
  formats: [],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "", method: "raw" },
    sections: AREAS.map((name) => ({
      day: null,
      kind: "objective",
      minutes: 12,
      name,
      questions: 8,
    })),
    timeLimitMinutes: 24,
    totalQuestions: 16,
  },
  rules: [],
  subjects: AREAS.map((name) => ({
    citation: CITATION,
    name,
    questions: 8,
    topics: [],
    weight: null,
  })),
};

const MATH_SHAPE = { area: "Mathematics", day: null, kind: "area" } as const;

async function anytimeSetup({
  itemsPerSkill = 4,
  plus = true,
  structure = STRUCTURE,
}: { itemsPerSkill?: number; plus?: boolean; structure?: object } = {}) {
  const [user, blueprint, skills] = await Promise.all([
    userFixture(),
    examBlueprintFixture({ structure }),
    Promise.all(
      AREAS.flatMap((area) =>
        Array.from({ length: SKILLS_PER_AREA }, (_, index) =>
          skillFixture({ name: `${area} topic ${index + 1} ${crypto.randomUUID()}` }),
        ),
      ),
    ),
  ]);

  const areaOf = (index: number) => AREAS[Math.floor(index / SKILLS_PER_AREA)] ?? "";

  const goal = await goalFixture({
    examBlueprintId: blueprint.id,
    kind: "exam",
    timezone: UTC,
    userId: user.id,
  });

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Basics" }],
      skills: skills.map((skill, index) => ({
        area: areaOf(index),
        lessons: 1,
        name: skill.name,
        phase: 0,
        skillId: skill.id,
        weight: null,
      })),
    },
  });

  await Promise.all([
    ...skills.map((skill, position) =>
      planItemFixture({ kind: "lesson", planId: plan.id, position, skillId: skill.id }),
    ),
    ...skills.flatMap((skill) =>
      Array.from({ length: itemsPerSkill }, () =>
        itemFixture({
          content: choiceItemContent(),
          examBlueprintId: blueprint.id,
          mockOnly: true,
          skillId: skill.id,
        }),
      ),
    ),
    plus
      ? prisma.subscription.create({
          data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
        })
      : null,
  ]);

  mockSession(user.id);

  return { goal, plan, skills, user };
}

async function readMock(id: string): Promise<MockView> {
  const result = await getMock(id);

  if (result.status !== "ready") {
    throw new Error("Expected the mock");
  }

  return result.mock;
}

async function answerSection({ id, rightOn }: { id: string; rightOn: ReadonlySet<string> }) {
  const mock = await readMock(id);

  await Promise.all(
    (mock.current?.questions ?? []).map((question) =>
      saveMockAnswer({
        blockId: id,
        input: {
          answer: { selectedIndex: rightOn.has(question.skillId) ? 0 : 1 },
          durationMs: 30_000,
          flagged: false,
          itemId: question.itemId,
        },
      }),
    ),
  );
}

async function startMath(goalId: string) {
  const started = await startAnytimeMock({ goalId, input: { shape: MATH_SHAPE } });

  if (started.status !== "started") {
    throw new Error(`Expected a started mock, got ${started.status}`);
  }

  return started.id;
}

describe("mocks taken any time", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("prepares the other exam day even when the first day is already ready", async () => {
    const { goal, plan, skills, user } = await anytimeSetup({
      structure: {
        ...STRUCTURE,
        mock: {
          ...STRUCTURE.mock,
          sections: STRUCTURE.mock.sections.map((section, index) => ({
            ...section,
            day: index + 1,
          })),
        },
      },
    });

    const secondDay = skills.slice(SKILLS_PER_AREA).map((skill) => skill.id);

    await prisma.item.updateMany({
      data: { retiredAt: SESSION_NOW },
      where: { skillId: { in: secondDay } },
    });

    const { papers } = await listMockPrepWrites({ goalId: goal.id });

    const fullDay = papers.find(
      (paper) => paper.key === mockPaperKey({ area: null, day: 2, kind: "full" }),
    );

    expect(fullDay).toMatchObject({ later: true });
    const writes = fullDay?.writes ?? [];

    expect(writes.flatMap((write) => write.skillIds).toSorted()).toStrictEqual(
      secondDay.toSorted(),
    );

    expect(
      writes.reduce((sum, write) => sum + write.questionsPerSkill * write.skillIds.length, 0),
    ).toBe(8);

    expect(papers.map((paper) => paper.key)).not.toContain(
      mockPaperKey({ area: null, day: 1, kind: "full" }),
    );

    const scheduledFor = new Date("2026-11-22");

    await prisma.plan.update({
      data: {
        settings: {
          mockFunding: [
            { contributions: [], date: "2026-11-22", day: 2, fullLength: false, minutes: 6 },
          ],
        },
      },
      where: { id: plan.id },
    });

    await planItemFixture({ kind: "mock", planId: plan.id, position: 10, scheduledFor });

    const scheduled = await listMockPrepWrites({
      goalId: goal.id,
      only: scheduledFor.toISOString(),
    });

    const scheduledWrites = scheduled.papers.flatMap((paper) => paper.writes);

    expect(scheduledWrites.flatMap((write) => write.skillIds).toSorted()).toStrictEqual(
      secondDay.toSorted(),
    );

    expect(
      scheduledWrites.reduce(
        (sum, write) => sum + write.questionsPerSkill * write.skillIds.length,
        0,
      ),
    ).toBe(4);

    await prisma.item.updateMany({
      data: { retiredAt: null },
      where: { skillId: { in: secondDay } },
    });

    await Promise.all(
      scheduledWrites.flatMap(({ questionsPerSkill, skillIds }) =>
        skillIds.flatMap((skillId) =>
          Array.from({ length: questionsPerSkill }, () =>
            itemFixture({ examBlueprintId: goal.examBlueprintId, mockOnly: true, skillId }),
          ),
        ),
      ),
    );

    await expect(listMockPrepWrites({ goalId: goal.id })).resolves.toMatchObject({ papers: [] });

    const shape = { area: null, day: 2, kind: "full" } as const;

    await expect(startAnytimeMock({ goalId: goal.id, input: { shape } })).resolves.toMatchObject({
      status: "started",
    });

    await expect(
      prisma.followUp.findFirst({
        where: { key: goal.id, kind: "prepareMockSupply", userId: user.id },
      }),
    ).resolves.toMatchObject({ input: { later: true } });

    const refill = await listMockPrepWrites({ goalId: goal.id });
    expect(refill.papers.map(({ key }) => key)).toContain(mockPaperKey(shape));
    expect(refill.papers.map(({ key }) => key)).not.toContain(scheduledFor.toISOString());
  });

  it("sweeps paid exam plans that have neither a scheduled mock nor a saved request", async () => {
    const { goal } = await anytimeSetup({ itemsPerSkill: 0 });
    const { goal: free } = await anytimeSetup({ itemsPerSkill: 0, plus: false });

    const due = await listDueMockGoals();

    expect(due).toContainEqual({
      examBlueprintId: goal.examBlueprintId,
      goalId: goal.id,
      later: true,
    });

    expect(due.map(({ goalId }) => goalId)).not.toContain(free.id);
  });

  it("lists each mock with its honest size: the day, half of it and each subject", async () => {
    const { goal } = await anytimeSetup();
    const result = await getMockOptions({ goalId: goal.id });

    expect(result).toMatchObject({
      status: "ready",
      view: {
        access: "open",
        options: [
          { day: null, estimatedMinutes: 24, kind: "full", minutes: 24, questions: 16 },
          { day: null, estimatedMinutes: 12, kind: "half", minutes: 12, questions: 8 },
          { area: "Mathematics", estimatedMinutes: 12, kind: "area", minutes: 12, questions: 8 },
          { area: "Languages", estimatedMinutes: 12, kind: "area", minutes: 12, questions: 8 },
        ],
        running: null,
      },
    });

    expect(result).toMatchObject({ view: { lastMock: null } });
  });

  it("says how long learners really take, once enough of them took the exam's mocks", async () => {
    const { goal } = await anytimeSetup();
    const others = await Promise.all(Array.from({ length: 5 }, () => userFixture()));

    async function finishedMocks(users: readonly { id: string }[], durationMs: number) {
      const mocks = await Promise.all(
        users.map((user) =>
          prisma.mockExam.create({
            data: {
              conditions: {},
              examBlueprintId: goal.examBlueprintId,
              finishedAt: SESSION_NOW,
              sectionStartedAt: SESSION_NOW,
              status: "finished",
              userId: user.id,
            },
          }),
        ),
      );

      await prisma.attempt.createMany({
        data: mocks.flatMap((mock) =>
          Array.from({ length: 20 }, () => ({
            answer: { selectedIndex: 0 },
            durationMs,
            hour: 12,
            isCorrect: true,
            localDate: SESSION_NOW,
            mockExamId: mock.id,
            userId: mock.userId,
            weekday: 1,
          })),
        ),
      });
    }

    await finishedMocks(others.slice(0, 4), 60_000);
    await finishedMocks(others.slice(4), 2000);

    async function estimates() {
      const result = await getMockOptions({ goalId: goal.id });
      const view = result.status === "ready" ? result.view : null;

      return { options: view?.options.map((option) => [option.kind, option.estimatedMinutes]) };
    }

    await expect(estimates()).resolves.toStrictEqual({
      options: [
        ["full", 24],
        ["half", 12],
        ["area", 12],
        ["area", 12],
      ],
    });

    await finishedMocks(others.slice(4), 60_000);

    await expect(estimates()).resolves.toStrictEqual({
      options: [
        ["full", 16],
        ["half", 8],
        ["area", 8],
        ["area", 8],
      ],
    });
  });

  it("starts one from questions never answered, and continues it instead of a second", async () => {
    const { goal, skills } = await anytimeSetup();
    const id = await startMath(goal.id);

    await expect(
      startAnytimeMock({ goalId: goal.id, input: { shape: MATH_SHAPE } }),
    ).resolves.toStrictEqual({ id, status: "running" });

    const mock = await readMock(id);
    const mathSkills = new Set(skills.slice(0, SKILLS_PER_AREA).map((skill) => skill.id));

    expect(mock).toMatchObject({
      planItemId: null,
      purpose: "practice",
      questions: 8,
      sessionId: null,
      shape: MATH_SHAPE,
      status: "running",
    });

    expect(mock.current?.questions.every((question) => mathSkills.has(question.skillId))).toBe(
      true,
    );

    await expect(getMockOptions({ goalId: goal.id })).resolves.toMatchObject({
      view: { running: { id, purpose: "practice", shape: MATH_SHAPE } },
    });
  });

  it("compares a mock with the last one of the same part of the exam", async () => {
    const { goal, skills } = await anytimeSetup({ itemsPerSkill: 12 });
    const everyTopic = new Set(skills.map((skill) => skill.id));

    async function take(shape: MockShape, rightOn: ReadonlySet<string>) {
      const started = await startAnytimeMock({ goalId: goal.id, input: { shape } });
      const id = started.status === "started" ? started.id : "";

      await answerSection({ id, rightOn });
      await finishMock({ blockId: id, input: { timeZone: UTC } });

      return readMock(id);
    }

    const first = await take(MATH_SHAPE, everyTopic);
    const half = await take({ area: null, day: null, kind: "half" }, new Set());
    const second = await take(MATH_SHAPE, new Set());

    expect(first.result?.previous).toBeNull();
    expect(half.result?.previous).toBeNull();
    expect(second.result?.previous).toBe(100);
  });

  it("says how the last mock went beside the options, opening its result", async () => {
    const { goal, skills } = await anytimeSetup({ itemsPerSkill: 12 });
    const mathSkills = new Set(skills.slice(0, SKILLS_PER_AREA).map((skill) => skill.id));

    const math = await startMath(goal.id);
    await answerSection({ id: math, rightOn: mathSkills });
    await finishMock({ blockId: math, input: { timeZone: UTC } });

    const later = new Date(SESSION_NOW.getTime() + 60 * 60 * 1000);
    vi.setSystemTime(later);

    const half = await startAnytimeMock({
      goalId: goal.id,
      input: { shape: { area: null, day: null, kind: "half" } },
    });

    const halfId = half.status === "started" ? half.id : "";
    await answerSection({ id: halfId, rightOn: new Set() });
    await finishMock({ blockId: halfId, input: { timeZone: UTC } });

    await expect(getMockOptions({ goalId: goal.id })).resolves.toMatchObject({
      view: {
        lastMock: {
          blockId: halfId,
          correct: 0,
          finishedAt: later.toISOString(),
          number: 2,
          purpose: "practice",
          shape: { area: null, day: null, kind: "half" },
          total: 8,
        },
      },
    });
  });

  it("grades it on its own, then offers to skip the lessons of topics it showed the learner knows", async () => {
    const { goal, plan, skills, user } = await anytimeSetup();
    const id = await startMath(goal.id);
    const [first, second] = skills;

    await answerSection({ id, rightOn: new Set([first?.id ?? ""]) });

    await expect(finishMock({ blockId: id, input: { timeZone: UTC } })).resolves.toStrictEqual({
      status: "finished",
    });

    const mock = await readMock(id);

    expect(mock.result).toMatchObject({ correct: 4, total: 8 });

    expect(
      Object.fromEntries(
        (mock.result?.topics ?? []).map((topic) => [topic.skillId, [topic.correct, topic.total]]),
      ),
    ).toStrictEqual({ [first?.id ?? ""]: [4, 4], [second?.id ?? ""]: [0, 4] });

    expect(mock.review).toHaveLength(4);
    expect(mock.adapt?.skip).toStrictEqual({ lessons: 1, topics: [first?.name] });

    const [attempts, event, progress, testedOut] = await Promise.all([
      prisma.attempt.findMany({ where: { mockExamId: id } }),
      prisma.learningEvent.findFirst({ where: { goalId: goal.id, kind: "mock" } }),
      prisma.userProgress.findUnique({ where: { userId: user.id } }),
      prisma.planItem.count({ where: { planId: plan.id, status: "testedOut" } }),
    ]);

    expect(attempts).toHaveLength(8);
    expect(attempts.every((attempt) => attempt.studySessionId === null)).toBe(true);

    expect(event).toMatchObject({
      correctAnswers: 4,
      incorrectAnswers: 4,
      lessonKind: "anytimeMock",
    });

    expect(Number(progress?.totalBrainPower)).toBeGreaterThan(0);

    expect(testedOut).toBe(0);

    await expect(
      adaptPlanFromMock({ blockId: id, input: { offer: "skip", timeZone: UTC } }),
    ).resolves.toMatchObject({ lessonsSkipped: 1, status: "applied" });

    const items = await prisma.planItem.findMany({ where: { planId: plan.id } });

    expect(items.find((item) => item.skillId === first?.id)?.status).toBe("testedOut");
    expect(items.find((item) => item.skillId === second?.id)?.status).toBe("todo");

    await expect(readMock(id)).resolves.toMatchObject({ adapt: null });
  });

  it("earns the belt its Brain Power crosses, with the level, Energy and ceremony on its result", async () => {
    const { goal, skills, user } = await anytimeSetup();
    const id = await startMath(goal.id);

    await prisma.userProgress.create({
      data: {
        currentEnergy: 79.9,
        lastActiveAt: SESSION_NOW,
        totalBrainPower: 2499n,
        userId: user.id,
      },
    });

    await answerSection({ id, rightOn: new Set(skills.map((skill) => skill.id)) });
    await finishMock({ blockId: id, input: { timeZone: UTC } });

    await expect(
      prisma.milestone.findMany({ select: { key: true, kind: true }, where: { userId: user.id } }),
    ).resolves.toStrictEqual([{ key: "yellow", kind: "belt" }]);

    expect(analytics.trackServerEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Big Challenge Finished",
        properties: { correct: 8, questions: 8 },
      }),
    );

    const result = {
      ceremony: { key: "yellow", kind: "belt", shownAt: null },
      reached: { energy: 80, level: { color: "yellow", level: 1 } },
    };

    await expect(readMock(id)).resolves.toMatchObject(result);

    await expect(readMock(id)).resolves.toMatchObject(result);
  });

  it("offers the area that went worst more of the plan's time, and says when it has it all", async () => {
    const { goal, plan, skills } = await anytimeSetup();
    const mathSkills = new Set(skills.slice(0, SKILLS_PER_AREA).map((skill) => skill.id));

    const started = await startAnytimeMock({
      goalId: goal.id,
      input: { shape: { area: null, day: null, kind: "full" } },
    });

    const id = started.status === "started" ? started.id : "";

    await answerSection({ id, rightOn: mathSkills });
    await finishMock({ blockId: id, input: { timeZone: UTC } });

    await expect(readMock(id)).resolves.toMatchObject({
      adapt: { focus: { area: "Languages", correct: 0, total: 8 } },
    });

    await expect(
      adaptPlanFromMock({ blockId: id, input: { offer: "focus", timeZone: UTC } }),
    ).resolves.toStrictEqual({ reason: "alreadyIn", status: "unchanged" });

    const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    expect(saved.settings).not.toMatchObject({ focusAreas: ["Languages"] });
  });

  it("saves a short request across devices and starts it only after the reserve is full", async () => {
    const { goal, skills, user } = await anytimeSetup({ itemsPerSkill: 3 });
    const input = { shape: MATH_SHAPE };

    await expect(startAnytimeMock({ goalId: goal.id, input })).resolves.toStrictEqual({
      status: "preparing",
    });

    await expect(prisma.mockExam.count({ where: { goalId: goal.id } })).resolves.toBe(0);

    await expect(
      prisma.followUp.count({ where: { kind: "prepareMockSupply", userId: user.id } }),
    ).resolves.toBe(1);

    await expect(getMockOptions({ goalId: goal.id })).resolves.toMatchObject({
      view: { requested: { shape: MATH_SHAPE, status: "preparing" } },
    });

    await Promise.all(
      skills
        .slice(0, 2)
        .map((skill) =>
          itemFixture({ examBlueprintId: goal.examBlueprintId, mockOnly: true, skillId: skill.id }),
        ),
    );

    await expect(getMockOptions({ goalId: goal.id })).resolves.toMatchObject({
      view: { requested: { shape: MATH_SHAPE, status: "ready" }, running: null },
    });

    const starts = await Promise.all([
      startAnytimeMock({ goalId: goal.id, input }),
      startAnytimeMock({ goalId: goal.id, input }),
    ]);

    expect(starts.map((start) => start.status).toSorted()).toStrictEqual(["running", "started"]);

    await expect(
      prisma.mockItemUse.count({ where: { spentAt: { not: null }, userId: user.id } }),
    ).resolves.toBe(8);
  });

  it("keeps the current section of a running scheduled mock out of repeat papers", async () => {
    const { blockId, goal, user } = await scheduledMockSetup();
    await startMock({ blockId, input: {} });
    const scheduled = await prisma.mockExam.findUniqueOrThrow({ where: { blockId } });

    const running = mockConditionsSchema
      .parse(scheduled.conditions)
      .sections.flatMap((part) => part.itemIds);

    await prisma.mockExam.createMany({
      data: Array.from({ length: 10 }, (_, index) => ({
        conditions: { purpose: "practice" },
        goalId: goal.id,
        sectionStartedAt: daysAgo(index + 1),
        startedAt: daysAgo(index + 1),
        status: "finished" as const,
        userId: user.id,
      })),
    });

    await prisma.item.updateMany({
      data: { retiredAt: SESSION_NOW },
      where: { examBlueprintId: goal.examBlueprintId, id: { notIn: running }, mockOnly: true },
    });

    await expect(
      startAnytimeMock({
        goalId: goal.id,
        input: { shape: { area: null, day: null, kind: "half" } },
      }),
    ).resolves.toStrictEqual({ status: "preparing" });

    await expect(
      prisma.followUp.findFirst({
        where: { key: goal.id, kind: "prepareMockSupply", userId: user.id },
      }),
    ).resolves.toMatchObject({ input: { later: false } });
  });

  it("keeps today's paper available before the learner's first on-demand mock", async () => {
    const { blockId, goal } = await scheduledMockSetup();

    const items = await prisma.item.findMany({
      take: 12,
      where: { examBlueprintId: goal.examBlueprintId },
    });

    await prisma.item.updateMany({
      data: { retiredAt: SESSION_NOW },
      where: { examBlueprintId: goal.examBlueprintId, id: { notIn: items.map((item) => item.id) } },
    });

    await expect(
      startAnytimeMock({
        goalId: goal.id,
        input: { shape: { area: null, day: null, kind: "half" } },
      }),
    ).resolves.toStrictEqual({ status: "preparing" });

    await expect(startMock({ blockId, input: {} })).resolves.toStrictEqual({ status: "ready" });
  });

  it("keeps one supply request after a scheduled writer recounts a still-short paper", async () => {
    const { blockId, goal, user } = await scheduledMockSetup();

    await prisma.item.updateMany({
      data: { retiredAt: SESSION_NOW },
      where: { examBlueprintId: goal.examBlueprintId },
    });

    const start = () => startMock({ blockId, input: {} });
    const where = { key: goal.id, kind: "prepareMockSupply" as const, userId: user.id };
    await expect(start()).resolves.toStrictEqual({ status: "preparing" });
    const first = await prisma.followUp.findFirstOrThrow({ where });
    await expect(start()).resolves.toStrictEqual({ status: "preparing" });

    await expect(prisma.followUp.findFirstOrThrow({ where })).resolves.toMatchObject({
      revision: first.revision,
    });

    await prisma.followUp.deleteMany({ where });
    await expect(start()).resolves.toStrictEqual({ status: "preparing" });
    await expect(prisma.followUp.count({ where })).resolves.toBe(0);
  });

  it("keeps one supply request for repeated starts of the same short paper", async () => {
    const { goal, user } = await anytimeSetup({ itemsPerSkill: 0 });
    const start = () => startAnytimeMock({ goalId: goal.id, input: { shape: MATH_SHAPE } });
    const where = { key: goal.id, kind: "prepareMockSupply" as const, userId: user.id };
    await Promise.all([start(), start()]);

    await expect(prisma.followUp.findFirstOrThrow({ where })).resolves.toMatchObject({
      revision: 0,
    });

    await prisma.followUp.deleteMany({ where });
    await expect(start()).resolves.toStrictEqual({ status: "preparing" });
    await expect(prisma.followUp.count({ where })).resolves.toBe(0);
  });

  it("keeps other choices eligible for priority after a waited-on paper is recounted", async () => {
    const { goal, user } = await anytimeSetup({ itemsPerSkill: 0 });
    const other = { area: null, day: null, kind: "full" } as const;

    await expect(
      startAnytimeMock({ goalId: goal.id, input: { shape: MATH_SHAPE } }),
    ).resolves.toStrictEqual({ status: "preparing" });

    await expect(checkMockSupply(goal.id, { priority: mockPaperKey(MATH_SHAPE) })).resolves.toBe(
      false,
    );

    await expect(
      startAnytimeMock({ goalId: goal.id, input: { shape: other } }),
    ).resolves.toStrictEqual({ status: "preparing" });

    await expect(
      prisma.followUp.findFirst({
        where: { key: goal.id, kind: "prepareMockSupply", userId: user.id },
      }),
    ).resolves.toMatchObject({ input: { later: false, paper: mockPaperKey(other) }, revision: 1 });
  });

  it("leaves the next attempt to daily supply when a background recount already found the requested paper short", async () => {
    const { goal, user } = await anytimeSetup({ itemsPerSkill: 0 });
    await checkMockSupply(goal.id);
    const shape = { area: null, day: null, kind: "full" } as const;

    await expect(startAnytimeMock({ goalId: goal.id, input: { shape } })).resolves.toStrictEqual({
      status: "preparing",
    });

    await expect(
      prisma.followUp.count({ where: { kind: "prepareMockSupply", userId: user.id } }),
    ).resolves.toBe(0);

    await expect(getMockOptions({ goalId: goal.id })).resolves.toMatchObject({
      view: { requested: { shape, status: "preparing" } },
    });
  });

  it("protects the next two scheduled papers, then uses the oldest compatible repeats", async () => {
    const { goal, plan, skills, user } = await anytimeSetup({ itemsPerSkill: 10 });

    const prior = await prisma.mockExam.createManyAndReturn({
      data: Array.from({ length: 10 }, (_, index) => ({
        conditions: { purpose: "practice" },
        goalId: goal.id,
        sectionStartedAt: daysAgo(index + 1),
        startedAt: daysAgo(index + 1),
        status: "finished",
        userId: user.id,
      })),
    });

    const math = await prisma.item.findMany({
      orderBy: { id: "asc" },
      take: 10,
      where: { skillId: { in: skills.slice(0, SKILLS_PER_AREA).map((skill) => skill.id) } },
    });

    await prisma.mockItemUse.createMany({
      data: math.map((item, index) => ({
        itemId: item.id,
        mockExamId: prior[index]!.id,
        section: 0,
        spentAt: daysAgo(index + 1),
        userId: user.id,
      })),
    });

    await Promise.all(
      [1, 2].map((offset) =>
        planItemFixture({
          kind: "mock",
          planId: plan.id,
          position: skills.length + offset,
          scheduledFor: daysAgo(-offset),
        }),
      ),
    );

    const started = await readMock(await startMath(goal.id));
    const picked = new Set(started.current?.questions.map((question) => question.itemId));
    expect(started.reusedQuestions).toBe(6);
    expect(math.filter((item) => picked.has(item.id))).toStrictEqual(math.slice(4));
  });

  it("owes only the missing items after ten starts and holds even repeated items for later sections", async () => {
    const { goal, plan, user } = await anytimeSetup();
    const input = { shape: { area: null, day: null, kind: "full" as const } };
    const first = await startAnytimeMock({ goalId: goal.id, input });

    if (first.status !== "started") {
      throw new Error(first.status);
    }

    const mock = await prisma.mockExam.update({
      data: { status: "finished" },
      where: { id: first.id },
    });

    await prisma.mockItemUse.updateMany({
      data: { spentAt: new Date() },
      where: { userId: user.id },
    });

    await expect(startAnytimeMock({ goalId: goal.id, input })).resolves.toStrictEqual({
      status: "preparing",
    });

    await prisma.mockExam.createMany({
      data: Array.from({ length: 9 }, () => ({
        conditions: mockConditionsSchema.parse(mock.conditions),
        goalId: goal.id,
        sectionStartedAt: SESSION_NOW,
        startedAt: SESSION_NOW,
        status: "finished",
        userId: user.id,
      })),
    });

    const omitted = await prisma.item.findMany({
      take: 2,
      where: { examBlueprintId: goal.examBlueprintId },
    });

    const omittedIds = omitted.map((item) => item.id);

    await prisma.item.updateMany({
      data: { retiredAt: SESSION_NOW },
      where: { id: { in: omittedIds } },
    });

    await expect(startAnytimeMock({ goalId: goal.id, input })).resolves.toStrictEqual({
      status: "preparing",
    });

    const { papers } = await listMockPrepWrites({
      goalId: goal.id,
      priority: mockPaperKey(input.shape),
    });

    expect(papers.map((paper) => paper.later)).toStrictEqual([false]);
    const writes = papers.flatMap((paper) => paper.writes);

    expect(
      writes.reduce((sum, write) => sum + write.questionsPerSkill * write.skillIds.length, 0),
    ).toBe(2);

    await expect(
      prisma.followUp.findFirst({ where: { kind: "prepareMockSupply", userId: user.id } }),
    ).resolves.toBeTruthy();

    await prisma.item.updateMany({ data: { retiredAt: null }, where: { id: { in: omittedIds } } });
    const started = await startAnytimeMock({ goalId: goal.id, input });

    if (started.status !== "started") {
      throw new Error(started.status);
    }

    await expect(readMock(started.id)).resolves.toMatchObject({
      questions: 16,
      reusedQuestions: 16,
    });

    const secondGoal = await goalFixture({
      examBlueprintId: goal.examBlueprintId,
      kind: "exam",
      userId: user.id,
    });

    await planFixture({ goalId: secondGoal.id, graph: parsePlanGraph(plan.graph) });
    const languages = { ...MATH_SHAPE, area: "Languages" };

    await expect(
      startAnytimeMock({ goalId: secondGoal.id, input: { shape: languages } }),
    ).resolves.toStrictEqual({ status: "preparing" });

    vi.setSystemTime(new Date(SESSION_NOW.getTime() + 24 * 60 * 60 * 1000));

    await expect(getMockOptions({ goalId: secondGoal.id })).resolves.toMatchObject({
      view: { requested: { shape: languages, status: "ready" } },
    });
  });
});

describe("an existing mock taken as placement", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps playing and grades only what was answered", async () => {
    const { goal, skills } = await anytimeSetup();

    const started = await startAnytimeMock({
      goalId: goal.id,
      input: { shape: { area: null, day: null, kind: "full" } },
    });

    const id = started.status === "started" ? started.id : "";
    const stored = await prisma.mockExam.findUniqueOrThrow({ where: { id } });

    await prisma.mockExam.update({
      data: {
        conditions: {
          ...mockConditionsSchema.parse(stored.conditions),
          purpose: "placement",
          shape: null,
        },
      },
      where: { id },
    });

    const running = await readMock(id);

    expect(running).toMatchObject({
      purpose: "placement",
      questions: 16,
      sections: [
        { minutes: 12, name: "Mathematics", questions: 8 },
        { minutes: 12, name: "Languages", questions: 8 },
      ],
      shape: null,
      status: "running",
    });

    const asked = running.current?.questions ?? [];
    const mathSkills = skills.slice(0, SKILLS_PER_AREA).map((skill) => skill.id);

    expect(new Set(asked.map((question) => question.skillId))).toStrictEqual(new Set(mathSkills));
    expect(new Set(asked.map((question) => question.itemId)).size).toBe(asked.length);

    const [first] = skills;
    const answered = asked.slice(0, 4);

    await Promise.all(
      answered.map((question) =>
        saveMockAnswer({
          blockId: id,
          input: {
            answer: { selectedIndex: question.skillId === first?.id ? 0 : 1 },
            durationMs: 20_000,
            flagged: false,
            itemId: question.itemId,
          },
        }),
      ),
    );

    await finishMock({ blockId: id, input: { timeZone: UTC } });

    const [finished, attempts, mistakes, options] = await Promise.all([
      readMock(id),
      prisma.attempt.findMany({ where: { mockExamId: id } }),
      prisma.mistake.count({ where: { userId: goal.userId } }),
      getMockOptions({ goalId: goal.id }),
    ]);

    expect(finished).toMatchObject({ adapt: null, result: { total: 4 }, status: "finished" });
    expect(attempts).toHaveLength(4);
    expect(mistakes).toBe(0);

    expect(options).toMatchObject({
      view: { lastMock: { purpose: "placement", total: 4 }, running: null },
    });
  });
});

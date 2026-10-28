import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockGuestSession, mockSession } from "../../_test-utils/mock-session";
import { getUsageRule } from "../../entitlements/limits";
import { SESSION_NOW, daysAgo } from "../../sessions/_test-utils/session-goal";
import { adaptPlanFromMock } from "./adapt-plan-from-mock";
import { finishMock } from "./finish-mock";
import { getMock } from "./get-mock";
import { getMockOptions } from "./get-mock-options";
import { type MockShape, type MockView } from "./mock-contract";
import { requestMockQuestions } from "./request-mock-questions";
import { saveMockAnswer } from "./save-mock-answer";
import { startAnytimeMock } from "./start-anytime-mock";

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
        itemFixture({ content: choiceItemContent(), skillId: skill.id }),
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
        placement: {
          mock: null,
          options: [
            { coversAllAreas: true, estimatedMinutes: 15, length: "short", questions: 10 },
            { coversAllAreas: true, estimatedMinutes: 24, length: "long", questions: 16 },
          ],
          recommended: "short",
        },
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

      return {
        options: view?.options.map((option) => [option.kind, option.estimatedMinutes]),
        placement: view?.placement?.options.map((option) => [
          option.questions,
          option.estimatedMinutes,
        ]),
      };
    }

    await expect(estimates()).resolves.toStrictEqual({
      options: [
        ["full", 24],
        ["half", 12],
        ["area", 12],
        ["area", 12],
      ],
      placement: [
        [10, 15],
        [16, 24],
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
      placement: [
        [15, 15],
        [16, 16],
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

  it("asks for the mock's questions first when the bank is short, or starts with fewer", async () => {
    const { goal, skills } = await anytimeSetup({ itemsPerSkill: 3 });

    await expect(
      startAnytimeMock({ goalId: goal.id, input: { shape: MATH_SHAPE } }),
    ).resolves.toStrictEqual({ status: "needsQuestions" });

    await expect(
      requestMockQuestions({ goalId: goal.id, input: { shape: MATH_SHAPE } }),
    ).resolves.toMatchObject({
      quickFormat: "multipleChoice",
      status: "start",
      writes: [
        {
          format: { writer: { kind: "quick" } },
          questionsPerSkill: 1,
          skillIds: skills.slice(0, SKILLS_PER_AREA).map((skill) => skill.id),
          target: 4,
        },
      ],
    });

    const started = await startAnytimeMock({
      goalId: goal.id,
      input: { acceptFewer: true, shape: MATH_SHAPE },
    });

    const id = started.status === "started" ? started.id : "";

    await expect(readMock(id)).resolves.toMatchObject({ questions: 6, status: "running" });
  });

  it("writes a subject's questions when the notice gives it a short name the plan doesn't use", async () => {
    const { goal, skills } = await anytimeSetup({ itemsPerSkill: 3 });

    await prisma.examBlueprint.update({
      data: {
        structure: {
          ...STRUCTURE,
          subjects: STRUCTURE.subjects.map((subject) =>
            subject.name === "Mathematics" ? { ...subject, shortName: "Numeracy" } : subject,
          ),
        },
      },
      where: { id: goal.examBlueprintId ?? "" },
    });

    const mathSkillIds = skills.slice(0, SKILLS_PER_AREA).map((skill) => skill.id);

    await expect(
      requestMockQuestions({ goalId: goal.id, input: { shape: MATH_SHAPE } }),
    ).resolves.toMatchObject({
      status: "start",
      writes: [{ questionsPerSkill: 1, skillIds: mathSkillIds, target: 4 }],
    });

    const full = { area: null, day: null, kind: "full" } as const;
    const written = await requestMockQuestions({ goalId: goal.id, input: { shape: full } });

    expect(written).toMatchObject({ status: "start" });

    const writtenSkillIds =
      written.status === "start" ? written.writes.flatMap((write) => write.skillIds) : [];

    expect(mathSkillIds.every((id) => writtenSkillIds.includes(id))).toBe(true);
  });

  it("never starts a mock of fewer than five questions", async () => {
    const { goal } = await anytimeSetup({ itemsPerSkill: 1 });

    await expect(
      startAnytimeMock({ goalId: goal.id, input: { acceptFewer: true, shape: MATH_SHAPE } }),
    ).resolves.toStrictEqual({ status: "notEnoughQuestions" });
  });

  it("offers none while no mock can be built: no notice or material, too few questions", async () => {
    const { goal, skills } = await anytimeSetup({ itemsPerSkill: 1 });

    await prisma.goal.update({ data: { examBlueprintId: null }, where: { id: goal.id } });

    await expect(getMockOptions({ goalId: goal.id })).resolves.toMatchObject({
      view: { options: [], placement: null },
    });

    const full = { area: null, day: null, kind: "full" } as const;

    await expect(
      startAnytimeMock({ goalId: goal.id, input: { shape: full } }),
    ).resolves.toStrictEqual({ status: "invalidOption" });

    await itemFixture({ content: choiceItemContent(), skillId: skills[0]?.id ?? "" });

    await expect(getMockOptions({ goalId: goal.id })).resolves.toMatchObject({
      view: { options: [{ kind: "full" }, { kind: "half" }] },
    });
  });
});

async function readMockItemIds(id: string): Promise<string[]> {
  const mock = await prisma.mockExam.findUniqueOrThrow({ where: { id } });
  const conditions = mock.conditions as { sections: { itemIds: string[] }[] };
  return conditions.sections.flatMap((section) => section.itemIds);
}

async function takeMath(goalId: string) {
  const id = await startMath(goalId);

  await answerSection({ id, rightOn: new Set() });
  await finishMock({ blockId: id, input: { timeZone: UTC } });

  return id;
}

async function useEveryMockWriteToday(userId: string) {
  const { day } = getUsageRule({ kind: "mockQuestions", tier: "plus" });
  await usageRecordsFixture({ count: day ?? 0, kind: "mockQuestions", userId });
}

describe("repeating mocks", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks new questions first, then the ones the learner missed, then the ones answered longest ago", async () => {
    const { goal, skills, user } = await anytimeSetup({ itemsPerSkill: 6 });
    const mathSkillIds = new Set(skills.slice(0, SKILLS_PER_AREA).map((skill) => skill.id));

    const mathItems = await prisma.item.findMany({
      orderBy: { id: "asc" },
      where: { skillId: { in: [...mathSkillIds] } },
    });

    const [fresh, missed, right] = [
      mathItems.slice(0, 2),
      mathItems.slice(2, 5),
      mathItems.slice(5),
    ];

    await Promise.all([
      ...missed.map((item, index) =>
        attemptFixture({
          answeredAt: daysAgo(index + 1),
          isCorrect: false,
          itemId: item.id,
          skillId: item.skillId,
          userId: user.id,
        }),
      ),
      ...right.map((item, index) =>
        attemptFixture({
          answeredAt: daysAgo(index + 1),
          isCorrect: true,
          itemId: item.id,
          skillId: item.skillId,
          userId: user.id,
        }),
      ),
      useEveryMockWriteToday(user.id),
    ]);

    const id = await startMath(goal.id);
    const asked = await readMockItemIds(id);

    expect(new Set(asked)).toStrictEqual(
      new Set([...fresh, ...missed, ...right.slice(-3)].map((item) => item.id)),
    );

    await expect(readMock(id)).resolves.toMatchObject({ questions: 8, reusedQuestions: 6 });
  });

  it("never pads a full mock with answered questions, and says what it lacks before it starts", async () => {
    const structure = {
      ...STRUCTURE,
      mock: {
        ...STRUCTURE.mock,
        sections: [
          { day: null, kind: "objective", minutes: 24, name: "Objective test", questions: 16 },
        ],
      },
      subjects: STRUCTURE.subjects.map((subject) => ({
        ...subject,
        questions: subject.name === "Mathematics" ? 10 : 6,
      })),
    };

    const { goal, skills, user } = await anytimeSetup({ structure });

    const items = await prisma.item.findMany({
      orderBy: { id: "asc" },
      where: { skillId: { in: skills.map((skill) => skill.id) } },
    });

    const areaOf = (skillId: string) =>
      skills.findIndex((skill) => skill.id === skillId) < SKILLS_PER_AREA
        ? "Mathematics"
        : "Languages";

    const math = items.filter((item) => areaOf(item.skillId) === "Mathematics");
    const languages = items.filter((item) => areaOf(item.skillId) === "Languages");

    const answered = [...math.slice(0, 2), ...languages.slice(0, 4)];

    await Promise.all([
      ...answered.map((item, index) =>
        attemptFixture({
          answeredAt: daysAgo(index + 1),
          isCorrect: false,
          itemId: item.id,
          skillId: item.skillId,
          userId: user.id,
        }),
      ),
      useEveryMockWriteToday(user.id),
    ]);

    const full = { shape: { area: null, day: null, kind: "full" as const } };

    await expect(startAnytimeMock({ goalId: goal.id, input: full })).resolves.toStrictEqual({
      examQuestions: 16,
      limit: "day",
      minutes: 15,
      questions: 10,
      status: "short",
    });

    await expect(prisma.mockExam.count({ where: { goalId: goal.id } })).resolves.toBe(0);

    const started = await startAnytimeMock({
      goalId: goal.id,
      input: { ...full, acceptFewer: true },
    });

    if (started.status !== "started") {
      throw new Error(`Expected a started mock, got ${started.status}`);
    }

    const asked = new Set(await readMockItemIds(started.id));
    const fresh = items.filter((item) => !answered.includes(item));

    expect(asked).toStrictEqual(new Set(fresh.map((item) => item.id)));

    await expect(readMock(started.id)).resolves.toMatchObject({
      examQuestions: 16,
      minutes: 15,
      questions: 10,
      reusedQuestions: 0,
    });
  });

  it("writes new questions for a mock taken again within fair use, and asks answered ones past it", async () => {
    const { goal, user } = await anytimeSetup();
    const first = await takeMath(goal.id);

    await expect(
      startAnytimeMock({ goalId: goal.id, input: { shape: MATH_SHAPE } }),
    ).resolves.toStrictEqual({ status: "needsQuestions" });

    await expect(
      requestMockQuestions({ goalId: goal.id, input: { shape: MATH_SHAPE } }),
    ).resolves.toMatchObject({ status: "start" });

    await expect(
      prisma.usageRecord.count({ where: { kind: "mockQuestions", userId: user.id } }),
    ).resolves.toBe(1);

    await useEveryMockWriteToday(user.id);

    await expect(
      requestMockQuestions({ goalId: goal.id, input: { shape: MATH_SHAPE } }),
    ).resolves.toStrictEqual({ status: "ready" });

    const second = await startMath(goal.id);

    expect(new Set(await readMockItemIds(second))).toStrictEqual(
      new Set(await readMockItemIds(first)),
    );

    await expect(readMock(second)).resolves.toMatchObject({ questions: 8, reusedQuestions: 8 });
  });

  it("takes one whenever the learner wants, past the day's study time and as many times as they like", async () => {
    const { goal, user } = await anytimeSetup();

    await Promise.all([
      learningProfileFixture({ dailyLimitMinutes: 10, userId: user.id }),
      dailyProgressFixtureMany([
        { date: new Date("2026-09-30T00:00:00Z"), timeSpentSeconds: 1200, userId: user.id },
      ]),
      useEveryMockWriteToday(user.id),
    ]);

    await takeMath(goal.id);
    await takeMath(goal.id);
    const third = await startMath(goal.id);

    await expect(readMock(third)).resolves.toMatchObject({ reusedQuestions: 8, status: "running" });
  });
});

describe("a mock taken as placement", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks every subject in the length picked, and grades only what was answered", async () => {
    const { goal, skills } = await anytimeSetup();

    const started = await startAnytimeMock({
      goalId: goal.id,
      input: { length: "short", purpose: "placement" },
    });

    const id = started.status === "started" ? started.id : "";
    const running = await readMock(id);

    expect(running).toMatchObject({
      purpose: "placement",
      questions: 10,
      sections: [
        { minutes: 8, name: "Mathematics", questions: 5 },
        { minutes: 8, name: "Languages", questions: 5 },
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
    expect(options).toMatchObject({ view: { placement: { mock: { id, status: "finished" } } } });
  });

  it("starts the suggested length, the quick check, when none is picked", async () => {
    const { goal } = await anytimeSetup();

    const started = await startAnytimeMock({ goalId: goal.id, input: { purpose: "placement" } });

    await expect(readMock(started.status === "started" ? started.id : "")).resolves.toMatchObject({
      purpose: "placement",
      questions: 10,
    });
  });

  it("comes with Plus: the free plan and guests see it with what it takes", async () => {
    const { goal, user } = await anytimeSetup({ plus: false });

    await expect(getMockOptions({ goalId: goal.id })).resolves.toMatchObject({
      view: { access: "plusRequired", placement: { mock: null, recommended: "short" } },
    });

    await expect(
      startAnytimeMock({ goalId: goal.id, input: { purpose: "placement" } }),
    ).resolves.toStrictEqual({ status: "plusRequired" });

    await expect(
      requestMockQuestions({ goalId: goal.id, input: { purpose: "placement" } }),
    ).resolves.toStrictEqual({ status: "plusRequired" });

    await prisma.user.update({ data: { isAnonymous: true }, where: { id: user.id } });
    mockGuestSession(user.id);

    await expect(getMockOptions({ goalId: goal.id })).resolves.toMatchObject({
      view: { access: "plusRequired", placement: { mock: null } },
    });

    await expect(
      startAnytimeMock({ goalId: goal.id, input: { purpose: "placement" } }),
    ).resolves.toStrictEqual({ status: "plusRequired" });
  });

  it("has questions written only for the places of topics the bank has none for", async () => {
    const { goal, skills } = await anytimeSetup({ itemsPerSkill: 3 });
    const [, second] = skills;

    await prisma.item.deleteMany({ where: { skillId: second?.id } });

    await expect(
      requestMockQuestions({ goalId: goal.id, input: { length: "short", purpose: "placement" } }),
    ).resolves.toMatchObject({
      status: "start",
      writes: [{ questionsPerSkill: 2, skillIds: [second?.id] }],
    });
  });
});

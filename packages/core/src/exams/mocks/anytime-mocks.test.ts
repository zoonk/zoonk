import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockGuestSession, mockSession } from "../../_test-utils/mock-session";
import { SESSION_NOW } from "../../sessions/_test-utils/session-goal";
import { adaptPlanFromMock } from "./adapt-plan-from-mock";
import { finishMock } from "./finish-mock";
import { getMock } from "./get-mock";
import { getMockOptions } from "./get-mock-options";
import { type MockShape, type MockView } from "./mock-contract";
import { requestMockQuestions } from "./request-mock-questions";
import { saveMockAnswer } from "./save-mock-answer";
import { startAnytimeMock } from "./start-anytime-mock";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@zoonk/ai/tasks/v2/mistakes/cause", () => ({ classifyMistakeCause: vi.fn() }));

const CITATION = { passage: "From the notice.", sourceId: "source" };
const AREAS = ["Mathematics", "Languages"] as const;
const SKILLS_PER_AREA = 2;
const UTC = "UTC";

/** One exam day of two sections of eight questions, each one of the notice's subjects. */
const STRUCTURE = {
  formats: [],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "", method: "raw" },
    sections: AREAS.map((name) => ({ day: null, minutes: 12, name, questions: 8 })),
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

/**
 * An exam goal whose plan has two areas of two skills each, one lesson per skill, and
 * `itemsPerSkill` questions on each skill in the shared bank.
 */
async function anytimeSetup({
  itemsPerSkill = 4,
  plus = true,
}: { itemsPerSkill?: number; plus?: boolean } = {}) {
  const [user, blueprint, skills] = await Promise.all([
    userFixture(),
    examBlueprintFixture({ structure: STRUCTURE }),
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

/** Answers every question of the running section: right on these skills, wrong on the rest. */
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
  const started = await startAnytimeMock({ goalId, input: { shape: MATH_SHAPE, timeZone: UTC } });

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
        // A quick check, and the whole test: half an hour would ask as many as an hour.
        placement: {
          mock: null,
          options: [
            { coversAllAreas: true, estimatedMinutes: 15, length: "short", questions: 10 },
            { coversAllAreas: true, estimatedMinutes: 24, length: "long", questions: 16 },
          ],
          // The quick check comes first; every length shows its time and the learner picks.
          recommended: "short",
        },
        running: null,
      },
    });
  });

  it("says how long learners really take, once enough of them took the exam's mocks", async () => {
    const { goal } = await anytimeSetup();
    const others = await Promise.all(Array.from({ length: 5 }, () => userFixture()));

    // Twenty answers of a minute each from four learners, and one learner's taps of two seconds.
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

    // Four learners aren't everyone yet, and taps of two seconds aren't a pace: the exam's own.
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

    // A minute a question: the clock still gives the exam's time, and more fits a quarter hour.
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
      startAnytimeMock({ goalId: goal.id, input: { shape: MATH_SHAPE, timeZone: UTC } }),
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
      const started = await startAnytimeMock({ goalId: goal.id, input: { shape, timeZone: UTC } });
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

  it("grades it on its own: its answers, Brain Power, a ledger row and each topic", async () => {
    const { goal, skills, user } = await anytimeSetup();
    const id = await startMath(goal.id);
    const [first, second] = skills;

    await answerSection({ id, rightOn: new Set([first?.id ?? ""]) });

    await expect(finishMock({ blockId: id, input: { timeZone: UTC } })).resolves.toStrictEqual({
      status: "finished",
    });

    const mock = await readMock(id);

    expect(mock.result).toMatchObject({ correct: 4, total: 8 });

    // Topics come in the order the mock first asked them, which its interleaving decides.
    expect(
      Object.fromEntries(
        (mock.result?.topics ?? []).map((topic) => [topic.skillId, [topic.correct, topic.total]]),
      ),
    ).toStrictEqual({ [first?.id ?? ""]: [4, 4], [second?.id ?? ""]: [0, 4] });

    expect(mock.review).toHaveLength(4);

    const [attempts, event, progress] = await Promise.all([
      prisma.attempt.findMany({ where: { mockExamId: id } }),
      prisma.learningEvent.findFirst({ where: { goalId: goal.id, kind: "mock" } }),
      prisma.userProgress.findUnique({ where: { userId: user.id } }),
    ]);

    expect(attempts).toHaveLength(8);
    expect(attempts.every((attempt) => attempt.studySessionId === null)).toBe(true);

    expect(event).toMatchObject({
      correctAnswers: 4,
      incorrectAnswers: 4,
      lessonKind: "anytimeMock",
    });

    expect(Number(progress?.totalBrainPower)).toBeGreaterThan(0);
  });

  it("offers to skip the lessons of topics it showed the learner knows, applied once they say so", async () => {
    const { goal, plan, skills } = await anytimeSetup();
    const id = await startMath(goal.id);
    const [first, second] = skills;

    await answerSection({ id, rightOn: new Set([first?.id ?? ""]) });
    await finishMock({ blockId: id, input: { timeZone: UTC } });

    const finished = await readMock(id);

    expect(finished.adapt?.skip).toStrictEqual({ lessons: 1, topics: [first?.name] });

    // Nothing moves until the learner says yes.
    await expect(
      prisma.planItem.count({ where: { planId: plan.id, status: "testedOut" } }),
    ).resolves.toBe(0);

    await expect(
      adaptPlanFromMock({ blockId: id, input: { offer: "skip", timeZone: UTC } }),
    ).resolves.toMatchObject({ lessonsSkipped: 1, status: "applied" });

    const items = await prisma.planItem.findMany({ where: { planId: plan.id } });

    expect(items.find((item) => item.skillId === first?.id)?.status).toBe("testedOut");
    expect(items.find((item) => item.skillId === second?.id)?.status).toBe("todo");

    // Once skipped, it isn't offered again.
    await expect(readMock(id)).resolves.toMatchObject({ adapt: null });
  });

  it("offers the area that went worst more of the plan's time, and says when it has it all", async () => {
    const { goal, plan, skills } = await anytimeSetup();
    const mathSkills = new Set(skills.slice(0, SKILLS_PER_AREA).map((skill) => skill.id));

    const started = await startAnytimeMock({
      goalId: goal.id,
      input: { shape: { area: null, day: null, kind: "full" }, timeZone: UTC },
    });

    const id = started.status === "started" ? started.id : "";

    await answerSection({ id, rightOn: mathSkills });
    await finishMock({ blockId: id, input: { timeZone: UTC } });

    await expect(readMock(id)).resolves.toMatchObject({
      adapt: { focus: { area: "Languages", correct: 0, total: 8 } },
    });

    // A plan this small has every lesson of every area in it already: nothing moves, and it says why.
    await expect(
      adaptPlanFromMock({ blockId: id, input: { offer: "focus", timeZone: UTC } }),
    ).resolves.toStrictEqual({ reason: "alreadyIn", status: "unchanged" });

    const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    expect(saved.settings).not.toMatchObject({ focusAreas: ["Languages"] });
  });

  it("asks for the mock's questions first when the bank is short, or starts with fewer", async () => {
    const { goal, skills } = await anytimeSetup({ itemsPerSkill: 3 });

    await expect(
      startAnytimeMock({ goalId: goal.id, input: { shape: MATH_SHAPE, timeZone: UTC } }),
    ).resolves.toStrictEqual({ status: "needsQuestions" });

    await expect(
      requestMockQuestions({ goalId: goal.id, input: { shape: MATH_SHAPE } }),
    ).resolves.toMatchObject({
      format: "multipleChoice",
      questionsPerSkill: 4,
      skillIds: skills.slice(0, SKILLS_PER_AREA).map((skill) => skill.id),
      status: "start",
    });

    const started = await startAnytimeMock({
      goalId: goal.id,
      input: { acceptFewer: true, shape: MATH_SHAPE, timeZone: UTC },
    });

    const id = started.status === "started" ? started.id : "";

    await expect(readMock(id)).resolves.toMatchObject({ questions: 6, status: "running" });
  });

  it("writes a subject's questions when the notice gives it a short name the plan doesn't use", async () => {
    const { goal, skills } = await anytimeSetup({ itemsPerSkill: 3 });

    // The OAB notice's "Estatuto da Advocacia e da OAB…" goes by "Ética Profissional": the plan's
    // area keeps the notice's full name, the options name the subject by its short one.
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
    ).resolves.toMatchObject({ questionsPerSkill: 4, skillIds: mathSkillIds, status: "start" });

    const full = { area: null, day: null, kind: "full" } as const;
    const written = await requestMockQuestions({ goalId: goal.id, input: { shape: full } });

    expect(written).toMatchObject({ status: "start" });

    const writtenSkillIds = written.status === "start" ? written.skillIds : [];
    expect(mathSkillIds.every((id) => writtenSkillIds.includes(id))).toBe(true);
  });

  it("never starts a mock of fewer than five questions", async () => {
    const { goal } = await anytimeSetup({ itemsPerSkill: 1 });

    await expect(
      startAnytimeMock({
        goalId: goal.id,
        input: { acceptFewer: true, shape: MATH_SHAPE, timeZone: UTC },
      }),
    ).resolves.toStrictEqual({ status: "notEnoughQuestions" });
  });

  it("offers none while no mock can be built: no notice or material, too few questions", async () => {
    const { goal, skills } = await anytimeSetup({ itemsPerSkill: 1 });

    // A class test with no material yet: no exam to copy, and four questions in the bank.
    await prisma.goal.update({ data: { examBlueprintId: null }, where: { id: goal.id } });

    await expect(getMockOptions({ goalId: goal.id })).resolves.toMatchObject({
      view: { options: [], placement: null },
    });

    const full = { area: null, day: null, kind: "full" } as const;

    await expect(
      startAnytimeMock({ goalId: goal.id, input: { shape: full, timeZone: UTC } }),
    ).resolves.toStrictEqual({ status: "invalidOption" });

    // Once the bank holds enough questions on its skills, mocks can be built from them.
    await itemFixture({ content: choiceItemContent(), skillId: skills[0]?.id ?? "" });

    await expect(getMockOptions({ goalId: goal.id })).resolves.toMatchObject({
      view: { options: [{ kind: "full" }, { kind: "half" }] },
    });
  });

  it("comes with Plus: the free plan sees what it would take", async () => {
    const { goal } = await anytimeSetup({ plus: false });

    await expect(getMockOptions({ goalId: goal.id })).resolves.toMatchObject({
      view: { access: "plusRequired" },
    });

    await expect(
      startAnytimeMock({ goalId: goal.id, input: { shape: MATH_SHAPE, timeZone: UTC } }),
    ).resolves.toStrictEqual({ status: "plusRequired" });

    await expect(
      requestMockQuestions({ goalId: goal.id, input: { shape: MATH_SHAPE } }),
    ).resolves.toStrictEqual({ status: "plusRequired" });
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
      input: { length: "short", purpose: "placement", timeZone: UTC },
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

    // Its questions spread over each subject's topics, never one twice.
    const asked = running.current?.questions ?? [];
    const mathSkills = skills.slice(0, SKILLS_PER_AREA).map((skill) => skill.id);

    expect(new Set(asked.map((question) => question.skillId))).toStrictEqual(new Set(mathSkills));
    expect(new Set(asked.map((question) => question.itemId)).size).toBe(asked.length);

    // Stopping after four answers keeps those four.
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
    // Measuring what they know: a wrong answer isn't a mistake in the notebook.
    expect(mistakes).toBe(0);
    expect(options).toMatchObject({ view: { placement: { mock: { id, status: "finished" } } } });
  });

  it("starts the suggested length, the quick check, when none is picked", async () => {
    const { goal } = await anytimeSetup();

    const started = await startAnytimeMock({
      goalId: goal.id,
      input: { purpose: "placement", timeZone: UTC },
    });

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
      startAnytimeMock({ goalId: goal.id, input: { purpose: "placement", timeZone: UTC } }),
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
      startAnytimeMock({ goalId: goal.id, input: { purpose: "placement", timeZone: UTC } }),
    ).resolves.toStrictEqual({ status: "plusRequired" });
  });

  it("has questions written only for the places of topics the bank has none for", async () => {
    const { goal, skills } = await anytimeSetup({ itemsPerSkill: 3 });
    const [, second] = skills;

    // The quick check asks the second topic twice; with none of its questions, those two places
    // are all that's written.
    await prisma.item.deleteMany({ where: { skillId: second?.id } });

    await expect(
      requestMockQuestions({ goalId: goal.id, input: { length: "short", purpose: "placement" } }),
    ).resolves.toMatchObject({ questionsPerSkill: 2, skillIds: [second?.id], status: "start" });
  });
});

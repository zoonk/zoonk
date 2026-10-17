import { gradeEssay } from "@zoonk/ai/tasks/v2/grading/grade-essay";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getChallenge } from "../../checkpoints/get-challenge";
import {
  DAY_MS,
  SESSION_NOW,
  SESSION_TODAY,
  checkpointItemFixture,
} from "../../sessions/_test-utils/session-goal";
import { getMock } from "./get-mock";
import { getMockOptions } from "./get-mock-options";
import { gradeMockEssays } from "./grade-mock-essays";
import { type MockView } from "./mock-contract";
import { saveMockAnswer } from "./save-mock-answer";
import { startAnytimeMock } from "./start-anytime-mock";
import { submitMockSection } from "./submit-mock-section";

const CITATION = { passage: "From the notice.", sourceId: "source" };
const UTC = "UTC";
const PASS_MARK = "Aprovado quem obtiver no mínimo 4 dos 8 pontos (50%).";

const GRADE = {
  criteria: [
    {
      comment: "Clear thesis.",
      example: null,
      id: "criterion-1",
      maxScore: 10,
      name: "Thesis",
      quote: null,
      score: 7,
    },
  ],
  enemInterventionElements: null,
  nextStep: { criterionId: "criterion-1", text: "Back the thesis with the law." },
  range: { high: 8, low: 6 },
  total: { maxScore: 10, score: 7 },
  zeroReason: null,
};

/**
 * A Cebraspe-style exam day: an objective test in the morning and a discursive test with its own
 * three hours in the afternoon, whose notice states a pass mark.
 */
const STRUCTURE = {
  formats: [
    {
      citation: CITATION,
      description: "Uma dissertação de até 30 linhas",
      kind: "essay",
      options: null,
    },
  ],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "", method: "raw" },
    sections: [
      { day: null, kind: "objective", minutes: 12, name: "Prova objetiva", questions: 8 },
      { day: null, kind: "written", minutes: 180, name: "Prova discursiva", questions: null },
    ],
    timeLimitMinutes: 192,
    totalQuestions: 8,
  },
  rules: [{ citation: CITATION, kind: "passMark", text: PASS_MARK }],
  subjects: [
    { citation: CITATION, name: "Mathematics", questions: 8, topics: [], weight: null },
    { citation: CITATION, name: "Prova discursiva", questions: null, topics: [], weight: null },
  ],
};

const FULL = { area: null, day: null, kind: "full" } as const;

/** A Plus learner's exam goal on two Mathematics skills, with the exam's own essay question. */
/** A day that is all written, like the OAB's second phase: one discursive test of three hours. */
const WRITTEN_ONLY = {
  ...STRUCTURE,
  mock: {
    ...STRUCTURE.mock,
    sections: [STRUCTURE.mock.sections[1]],
    timeLimitMinutes: 180,
    totalQuestions: null,
  },
};

async function writtenExamSetup({
  structure = STRUCTURE,
}: { structure?: typeof STRUCTURE | typeof WRITTEN_ONLY } = {}) {
  const [user, blueprint, skills] = await Promise.all([
    userFixture(),
    examBlueprintFixture({ structure }),
    Promise.all(
      [1, 2].map((index) =>
        skillFixture({ name: `Mathematics topic ${index} ${crypto.randomUUID()}` }),
      ),
    ),
  ]);

  const goal = await goalFixture({
    examBlueprintId: blueprint.id,
    kind: "exam",
    targetDate: new Date(SESSION_TODAY.getTime() + 10 * DAY_MS),
    timezone: UTC,
    userId: user.id,
  });

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Basics" }],
      skills: skills.map((skill) => ({
        area: "Mathematics",
        lessons: 1,
        name: skill.name,
        phase: 0,
        skillId: skill.id,
        weight: null,
      })),
    },
  });

  const [essay] = await Promise.all([
    itemFixture({
      content: {
        context: "Texto de apoio sobre controle externo.",
        keyPoints: ["Cites the constitution"],
        question: "Disserte sobre o controle externo da administração pública.",
        rubric: [
          { criterion: "Thesis", description: "A clear thesis", points: null },
          { criterion: "Legal basis", description: "Cites the law", points: null },
        ],
        sampleOutline: "Thesis, two arguments, conclusion.",
      },
      examBlueprintId: blueprint.id,
      format: "essay",
      skillId: skills[0]?.id ?? "",
    }),
    ...skills.map((skill, position) =>
      planItemFixture({ kind: "lesson", planId: plan.id, position, skillId: skill.id }),
    ),
    ...skills.flatMap((skill) =>
      Array.from({ length: 4 }, () =>
        itemFixture({ content: choiceItemContent(), skillId: skill.id }),
      ),
    ),
    prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    }),
  ]);

  mockSession(user.id);

  return { essay, goal, plan, user };
}

async function readMock(id: string): Promise<MockView> {
  const result = await getMock(id);

  if (result.status !== "ready") {
    throw new Error("Expected the mock");
  }

  return result.mock;
}

async function startFull(goalId: string) {
  const started = await startAnytimeMock({
    goalId,
    input: { acceptFewer: true, shape: FULL, timeZone: UTC },
  });

  if (started.status !== "started") {
    throw new Error(`Expected a started mock, got ${started.status}`);
  }

  return started.id;
}

/** Hands in the objective test, then writes the essay of the afternoon's written test. */
async function writeEssay({ id, text }: { id: string; text: string }) {
  await submitMockSection({ blockId: id, input: { timeZone: UTC }, section: 0 });

  const written = await readMock(id);
  const essay = written.current?.questions.find((question) => question.format === "essay");

  await saveMockAnswer({
    blockId: id,
    input: { answer: { text }, durationMs: 600_000, flagged: false, itemId: essay?.itemId ?? "" },
  });

  return { essay, written };
}

describe("a full mock of an exam with a written test", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);

    vi.mocked(gradeEssay).mockResolvedValue({
      data: GRADE,
      provenance: null,
      systemPrompt: "",
      usage: null,
      userPrompt: "",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(gradeEssay).mockReset();
  });

  it("offers the whole exam day, the written test included, at its real length", async () => {
    const { goal } = await writtenExamSetup();
    const result = await getMockOptions({ goalId: goal.id });
    const options = result.status === "ready" ? result.view.options : [];

    expect(options.find((option) => option.kind === "full")).toMatchObject({
      minutes: 192,
      objectiveOnly: false,
      questions: 8,
      written: ["Prova discursiva"],
    });

    expect(options.find((option) => option.kind === "half")).toMatchObject({
      objectiveOnly: true,
      written: [],
    });
  });

  it("asks the essay on its own clock, shows the objective result at once, then grades it", async () => {
    const { essay, goal, user } = await writtenExamSetup();
    const id = await startFull(goal.id);
    const started = await readMock(id);

    // A mock of the whole exam shows the notice's pass mark.
    expect(started.passMarks).toMatchObject({ texts: [PASS_MARK] });

    expect(
      started.sections.map((section) => [section.name, section.questions, section.essays]),
    ).toStrictEqual([
      ["Prova objetiva", 8, 0],
      ["Prova discursiva", 0, 1],
    ]);

    const choice = started.current?.questions[0]?.itemId ?? "";

    // A pick never lands on the essay, and text never lands on a question.
    await expect(
      saveMockAnswer({
        blockId: id,
        input: { answer: { text: "Texto." }, durationMs: 1000, flagged: false, itemId: choice },
      }),
    ).resolves.toStrictEqual({ status: "invalidItem" });

    const text = "O controle externo cabe ao Congresso, com o auxílio do TCU.";
    const { written } = await writeEssay({ id, text });

    expect(written.current?.questions).toMatchObject([
      {
        format: "essay",
        itemId: essay.id,
        options: null,
        question: "Disserte sobre o controle externo da administração pública.",
      },
    ]);

    await expect(
      saveMockAnswer({
        blockId: id,
        input: { answer: { selectedIndex: 0 }, durationMs: 1000, flagged: false, itemId: essay.id },
      }),
    ).resolves.toStrictEqual({ status: "invalidItem" });

    await submitMockSection({ blockId: id, input: { timeZone: UTC }, section: 1 });

    // Handing in grades the questions right away; the essay waits for its own grading.
    const finished = await readMock(id);

    expect(finished.status).toBe("finished");
    expect(finished.result).toMatchObject({ total: 8 });

    expect(finished.essays).toMatchObject([
      { grade: null, itemId: essay.id, status: "pending", text },
    ]);

    expect(gradeEssay).not.toHaveBeenCalled();

    await expect(gradeMockEssays({ blockId: id, input: { timeZone: UTC } })).resolves.toStrictEqual(
      { status: "graded" },
    );

    const graded = await readMock(id);

    expect(graded.essays).toMatchObject([{ grade: GRADE, status: "graded", text }]);
    expect(graded.essayRubric).toBe("custom");

    // Asking again grades nothing twice: the grade is kept on the mock's attempt.
    await gradeMockEssays({ blockId: id, input: { timeZone: UTC } });

    expect(gradeEssay).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        essay: text,
        prompt:
          "Texto de apoio sobre controle externo.\n\nDisserte sobre o controle externo da administração pública.",
      }),
    );

    await expect(
      prisma.attempt.count({ where: { itemId: essay.id, mockExamId: id, userId: user.id } }),
    ).resolves.toBe(1);
  });

  it("asks the written test in the plan's full mock of the final stretch, as the real exam does", async () => {
    const { plan } = await writtenExamSetup();

    // The final stretch started yesterday: the week's mock sits the whole exam day.
    await prisma.plan.update({
      data: {
        phases: [
          { kind: "learn", name: "Learn", startDate: "2026-09-01" },
          { kind: "finalStretch", name: "Final stretch", startDate: "2026-09-29" },
        ],
      },
      where: { id: plan.id },
    });

    const mock = await checkpointItemFixture({
      kind: "mock",
      planId: plan.id,
      position: 10,
      scheduledFor: new Date(SESSION_TODAY.getTime() + DAY_MS),
    });

    const result = await getChallenge({ input: {}, planItemId: mock.id });
    const challenge = result.status === "ready" ? result.challenge : null;

    expect(challenge).toMatchObject({ fullLength: true, minutes: 192, mock: true });
    expect(challenge?.sections.map((section) => section.name)).toStrictEqual(["Prova objetiva"]);

    expect(
      challenge?.written.map(({ asked, minutes, name }) => ({ asked, minutes, name })),
    ).toStrictEqual([{ asked: true, minutes: 180, name: "Prova discursiva" }]);
  });

  it("sits a day that is all written as a full mock, its result the essay's grade", async () => {
    const { essay, goal } = await writtenExamSetup({ structure: WRITTEN_ONLY });
    const id = await startFull(goal.id);
    const started = await readMock(id);

    expect(started.sections.map((section) => [section.questions, section.essays])).toStrictEqual([
      [0, 1],
    ]);

    expect(started.current?.questions.map((question) => question.format)).toStrictEqual(["essay"]);

    await saveMockAnswer({
      blockId: id,
      input: { answer: { text: "Um texto." }, durationMs: 1000, flagged: false, itemId: essay.id },
    });

    await submitMockSection({ blockId: id, input: { timeZone: UTC }, section: 0 });

    await expect(readMock(id)).resolves.toMatchObject({
      essays: [{ itemId: essay.id, status: "pending" }],
      result: { total: 0 },
      status: "finished",
    });
  });

  it("keeps the essay for another day once the day's essay grades are used", async () => {
    const { essay, goal, user } = await writtenExamSetup();
    const id = await startFull(goal.id);

    await writeEssay({ id, text: "Um texto." });
    await submitMockSection({ blockId: id, input: { timeZone: UTC }, section: 1 });

    await prisma.attempt.createMany({
      data: Array.from({ length: 6 }, () => ({
        answer: {},
        durationMs: 1000,
        hour: 12,
        isCorrect: true,
        itemId: essay.id,
        localDate: getDateInTimeZone({ date: SESSION_NOW, timeZone: UTC }),
        userId: user.id,
        weekday: 1,
      })),
    });

    await expect(gradeMockEssays({ blockId: id, input: { timeZone: UTC } })).resolves.toStrictEqual(
      { status: "limitReached" },
    );

    expect(gradeEssay).not.toHaveBeenCalled();
    await expect(readMock(id)).resolves.toMatchObject({ essays: [{ status: "pending" }] });
  });
});

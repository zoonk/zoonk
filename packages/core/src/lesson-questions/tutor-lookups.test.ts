import { randomUUID } from "node:crypto";
import { type GoalTutorLookUpRequest } from "@zoonk/ai/tasks/v2/tutor/goal-tutor-lookup";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { beforeEach, describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { type MockConditions, type MockResult } from "../exams/mocks/mock-contract";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { getSyllabusView } from "../view-models/syllabus/get-syllabus-view";
import { claimLessonQuestionAnswer, completeLessonQuestionAnswer } from "./answer-lifecycle";
import { createLessonQuestion } from "./create-lesson-question";
import { lookUpTutorData } from "./look-up-tutor-data";

const MODEL = "openai/gpt-6-luna";

async function plannedLearner() {
  const user = await userFixture();

  const library = await planLibraryFixture({
    skills: [
      { area: "Math", lessons: 3 },
      { area: "Biology", lessons: 3 },
    ],
  });

  const { goal } = await unplannedGoalFixture({ dailyMinutes: 12, userId: user.id });
  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  return { goal, library, user };
}

async function learnerWithEmptyPlan() {
  const user = await userFixture();
  const goal = await goalFixture({ userId: user.id });
  await planFixture({ goalId: goal.id, graph: { phases: [], skills: [] } });
  mockSession(user.id);

  return { goal, user };
}

async function answering(goalId: string) {
  const created = await createLessonQuestion({
    input: { context: { kind: "plan" }, question: "How am I doing?", requestId: randomUUID() },
    target: { goalId, kind: "plan" },
  });

  if (created.status !== "created") {
    throw new Error(`Expected a created question, received ${created.status}`);
  }

  const claimed = await claimLessonQuestionAnswer({
    questionId: created.question.id,
    requestedModel: MODEL,
  });

  if (claimed.status !== "ready") {
    throw new Error(`Expected a claimed answer, received ${claimed.status}`);
  }

  return { questionId: created.question.id, revision: claimed.claim.revision };
}

function lookUp(
  asked: { questionId: string; revision: number },
  request: Partial<GoalTutorLookUpRequest> & Pick<GoalTutorLookUpRequest, "what">,
) {
  return lookUpTutorData({ area: null, query: null, ...asked, ...request });
}

const MOCK_CONDITIONS: MockConditions = {
  day: null,
  examQuestions: null,
  fullLength: true,
  partialCredit: "allOrNothing",
  purpose: "practice",
  reused: 0,
  scoring: "raw",
  sections: [{ essays: [], itemIds: [], minutes: 20, name: null, questions: 10, routing: null }],
  shape: { area: null, day: null, kind: "full" },
  startTime: null,
  timeZone: null,
  timedOutSections: [],
  wrongPenalty: 1,
};

function mockResult(): MockResult {
  return {
    areas: [
      {
        correct: 6,
        name: "Math",
        score: null,
        secondsPerQuestion: 90,
        targetSecondsPerQuestion: null,
        total: 10,
      },
    ],
    blank: 1,
    calibration: null,
    coherence: null,
    correct: 6,
    irt: null,
    minutesUsed: 15,
    net: null,
    plannedMinutes: 20,
    preparation: null,
    previous: null,
    scoring: "raw",
    topics: [],
    total: 10,
    unansweredAtTimeout: 0,
  };
}

describe(lookUpTutorData, () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("reads a subject's progress from the learner's own answers and mistakes", async () => {
    const [{ goal, library, user }, other] = await Promise.all([plannedLearner(), userFixture()]);
    const math = library.skills[0]?.id ?? "";
    const longAgo = new Date(Date.now() - 60 * MS_PER_DAY);

    await Promise.all([
      attemptFixture({ isCorrect: true, skillId: math, userId: user.id }),
      attemptFixture({ isCorrect: true, skillId: math, userId: user.id }),
      attemptFixture({ isCorrect: false, skillId: math, userId: user.id }),
      attemptFixture({ answeredAt: longAgo, isCorrect: false, skillId: math, userId: user.id }),
      attemptFixture({ isCorrect: false, skillId: math, userId: other.id }),
      mistakeFixture({ skillId: math, userId: user.id }),
      mistakeFixture({ skillId: math, status: "fixed", userId: user.id }),
    ]);

    const asked = await answering(goal.id);

    await expect(lookUp(asked, { area: "math", what: "subjectProgress" })).resolves.toMatchObject({
      status: "found",
      subjects: [
        { answers: { right: 2, total: 3 }, lessonsDone: 0, lessonsTotal: 3, openMistakes: 1 },
      ],
      what: "subjectProgress",
    });

    await expect(
      lookUp(asked, { area: "Chemistry", what: "subjectProgress" }),
    ).resolves.toStrictEqual({
      areas: expect.arrayContaining(["Math", "Biology"]),
      status: "notFound",
      what: "subjectProgress",
    });
  });

  it("finds a lesson of the plan by its title, with its key ideas and when it's planned", async () => {
    const { goal, library } = await plannedLearner();
    const [lesson] = library.lessons;

    if (!lesson) {
      throw new Error("Expected a planned lesson");
    }

    await prisma.lesson.update({
      data: { summary: { ideas: [{ text: "Fractions are parts of a whole." }] } },
      where: { id: lesson.id },
    });

    const asked = await answering(goal.id);

    await expect(lookUp(asked, { query: lesson.title, what: "lesson" })).resolves.toMatchObject({
      lessons: [
        { date: expect.any(String), done: false, ideas: ["Fractions are parts of a whole."] },
      ],
      status: "found",
      what: "lesson",
    });

    await expect(lookUp(asked, { query: "Quantum spin", what: "lesson" })).resolves.toStrictEqual({
      status: "notFound",
      what: "lesson",
    });
  });

  it("finds the learner's older mistakes by their topic, never another learner's", async () => {
    const [{ goal, library, user }, other] = await Promise.all([plannedLearner(), userFixture()]);
    const [math, biology] = library.skills;

    await Promise.all([
      mistakeFixture({
        cause: "trap",
        skillId: math?.id,
        snapshot: { answer: "Certo", correctAnswer: "Errado", question: "Concordância com haver" },
        userId: user.id,
      }),
      mistakeFixture({
        skillId: biology?.id,
        snapshot: { answer: "A", question: "Photosynthesis" },
        userId: user.id,
      }),
      mistakeFixture({
        skillId: math?.id,
        snapshot: { answer: "B", question: "Concordância verbal" },
        userId: other.id,
      }),
    ]);

    const asked = await answering(goal.id);

    await expect(lookUp(asked, { query: "concordancia", what: "mistakes" })).resolves.toMatchObject(
      {
        mistakes: [
          {
            answer: "Certo",
            cause: "trap",
            correctAnswer: "Errado",
            question: "Concordância com haver",
            status: "open",
          },
        ],
        moreMistakes: 0,
        status: "found",
      },
    );

    await expect(lookUp(asked, { area: "Biology", what: "mistakes" })).resolves.toMatchObject({
      mistakes: [{ question: "Photosynthesis" }],
      status: "found",
    });
  });

  it("reads the mocks the learner finished for the goal, with no estimate when the scoring gives none", async () => {
    const [{ goal, user }, otherGoal] = await Promise.all([
      learnerWithEmptyPlan(),
      userFixture().then((other) => goalFixture({ userId: other.id })),
    ]);

    const asked = await answering(goal.id);

    await expect(lookUp(asked, { what: "mocks" })).resolves.toStrictEqual({
      status: "notFound",
      what: "mocks",
    });

    const finished = {
      conditions: MOCK_CONDITIONS,
      finishedAt: new Date(),
      result: mockResult(),
      sectionStartedAt: new Date(),
      status: "finished" as const,
    };

    await prisma.mockExam.createMany({
      data: [
        { ...finished, goalId: goal.id, userId: user.id },
        { ...finished, goalId: otherGoal.id, userId: otherGoal.userId },
      ],
    });

    await expect(lookUp(asked, { what: "mocks" })).resolves.toMatchObject({
      mocks: [
        {
          areas: [{ correct: 6, name: "Math", total: 10 }],
          correct: 6,
          estimate: null,
          kind: "full",
          number: 1,
          total: 10,
        },
      ],
      status: "found",
    });
  });

  it("checks the exam notice's topics for words the learner asks about", async () => {
    const user = await userFixture();

    const blueprint = await examBlueprintFixture({
      structure: {
        formats: [],
        mock: null,
        rules: [],
        subjects: [
          {
            citation: { passage: "Conteúdo programático", sourceId: "notice" },
            group: null,
            name: "Direito Administrativo",
            questions: 15,
            topics: ["Atos administrativos", "Lei nº 8.112/1990: regime jurídico dos servidores"],
            weight: null,
          },
          {
            citation: { passage: "Conteúdo programático", sourceId: "notice" },
            group: null,
            name: "Língua Portuguesa",
            questions: 20,
            topics: ["Concordância verbal"],
            weight: null,
          },
        ],
      },
    });

    const goal = await goalFixture({
      examBlueprintId: blueprint.id,
      kind: "exam",
      title: "Câmara",
      userId: user.id,
    });

    const plan = await planFixture({ goalId: goal.id, graph: { phases: [], skills: [] } });
    await planItemFixture({ planId: plan.id, position: 0 });
    mockSession(user.id);

    const asked = await answering(goal.id);

    await expect(lookUp(asked, { query: "lei 8112", what: "noticeTopics" })).resolves.toMatchObject(
      {
        status: "found",
        subjects: [
          {
            moreTopics: 0,
            name: "Direito Administrativo",
            topics: [{ name: "Lei nº 8.112/1990: regime jurídico dos servidores" }],
          },
        ],
      },
    );

    await expect(
      lookUp(asked, { query: "direito tributário", what: "noticeTopics" }),
    ).resolves.toStrictEqual({
      areas: ["Direito Administrativo", "Língua Portuguesa"],
      status: "notFound",
      what: "noticeTopics",
    });
  });

  it("looks up only for the answer being written, in its learner's own goal", async () => {
    const [{ goal }, other] = await Promise.all([learnerWithEmptyPlan(), userFixture()]);
    const asked = await answering(goal.id);

    await expect(lookUp(asked, { what: "noticeTopics" })).resolves.toStrictEqual({
      reason: "notExam",
      status: "unavailable",
      what: "noticeTopics",
    });

    mockSession(other.id);

    await expect(lookUp(asked, { what: "mistakes" })).resolves.toStrictEqual({
      status: "notFound",
      what: "mistakes",
    });

    mockSession(null);

    await expect(lookUp(asked, { what: "mistakes" })).resolves.toStrictEqual({
      status: "unauthorized",
    });
  });

  it("stops looking up once the answer is saved", async () => {
    const { goal } = await learnerWithEmptyPlan();
    const asked = await answering(goal.id);

    await completeLessonQuestionAnswer({
      ...asked,
      answer: "Done.",
      finishReason: "stop",
      generatedAt: new Date().toISOString(),
      model: MODEL,
      promptVersion: "goal-tutor-test",
      provider: "openai",
      runId: "run-lookups",
    });

    await expect(lookUp(asked, { what: "mocks" })).resolves.toStrictEqual({
      status: "notFound",
      what: "mocks",
    });
  });

  it("tells the lessons a test skipped apart from the ones the learner finished", async () => {
    const { goal, library } = await plannedLearner();
    const [first, second] = library.lessons;

    await prisma.planItem.updateMany({
      data: { status: "testedOut" },
      where: { lessonId: { in: [first?.id ?? "", second?.id ?? ""] }, plan: { goalId: goal.id } },
    });

    const asked = await answering(goal.id);

    await expect(lookUp(asked, { area: "Math", what: "subjectProgress" })).resolves.toMatchObject({
      subjects: [{ lessonsDone: 2, lessonsTestedOut: 2, lessonsTotal: 3 }],
    });
  });
});

function graphSkill(skill: { id: string; name: string }, area: string) {
  return { area, lessons: 2, name: skill.name, phase: 0, skillId: skill.id };
}

async function oabLearner() {
  const user = await userFixture();
  const citation = { passage: "Conteúdo programático", sourceId: "notice" };

  const blueprint = await examBlueprintFixture({
    structure: {
      formats: [],
      mock: null,
      pastQuestions: {
        checkedAt: new Date().toISOString(),
        edition: "44º Exame",
        source: { title: "Prova do 44º Exame", url: "https://example.com/44-exame.pdf" },
        subjects: [
          { name: "Ética Profissional", questions: 8 },
          { name: "Direito Civil", questions: 7 },
        ],
      },
      rules: [],
      subjects: [
        {
          citation,
          group: null,
          name: "Ética Profissional",
          questions: null,
          topics: [],
          weight: null,
        },
        { citation, group: null, name: "Direito Civil", questions: null, topics: [], weight: null },
      ],
    },
  });

  const [goal, ethics, civil] = await Promise.all([
    goalFixture({ examBlueprintId: blueprint.id, kind: "exam", title: "OAB", userId: user.id }),
    skillFixture({ name: "Aplicar o Estatuto da Advocacia" }),
    skillFixture({ name: "Avaliar negócios jurídicos" }),
  ]);

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ name: "Fundamentos" }],
      skills: [graphSkill(ethics, "Ética Profissional"), graphSkill(civil, "Direito Civil")],
    },
  });

  await planItemFixture({ planId: plan.id, position: 0, skillId: ethics.id });
  mockSession(user.id);

  return goal;
}

describe("the exam's question counts the buddy reads", () => {
  it("are the ones the app shows: the latest edition's when the notice gives none, with their source", async () => {
    const goal = await oabLearner();

    const created = await createLessonQuestion({
      input: {
        context: { kind: "plan" },
        question: "A Ética cai quanto?",
        requestId: randomUUID(),
      },
      target: { goalId: goal.id, kind: "plan" },
    });

    if (created.status !== "created") {
      throw new Error(`Expected a created question, received ${created.status}`);
    }

    const [claimed, syllabus] = await Promise.all([
      claimLessonQuestionAnswer({ questionId: created.question.id, requestedModel: MODEL }),
      getSyllabusView({ goalId: goal.id }),
    ]);

    const shown =
      syllabus.status === "ready"
        ? syllabus.syllabus.subjects.find((subject) => subject.name === "Ética Profissional")
        : null;

    expect(shown?.questions).toBe(8);

    expect(claimed).toMatchObject({
      claim: {
        contextSnapshot: {
          exam: {
            questionsSource: {
              edition: "44º Exame",
              title: "Prova do 44º Exame",
              url: "https://example.com/44-exame.pdf",
            },
            subjects: [
              { fromLatestEdition: true, name: "Ética Profissional", questions: 8 },
              { fromLatestEdition: true, name: "Direito Civil", questions: 7 },
            ],
          },
        },
      },
      status: "ready",
    });
  });
});

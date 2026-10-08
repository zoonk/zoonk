import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { pronunciationReviewFixture } from "@zoonk/testing/fixtures/pronunciation-reviews";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { normalizeString } from "@zoonk/utils/string";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { claimLessonQuestionAnswer, completeLessonQuestionAnswer } from "./answer-lifecycle";
import { createLessonQuestion } from "./create-lesson-question";
import { getLessonQuestionThread } from "./get-lesson-question-thread";
import { offerTutorTool } from "./offer-tutor-tool";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

// PostHog is an external service; asking the tutor sends an event.
vi.mock("../analytics/server", () => ({ trackServerEvent: vi.fn() }));

/** A Monday in 2020, before the learning events other tests write, so estimates stay put. */
const NOW = new Date("2020-09-28T12:00:00Z");

const ANSWER_RUN = {
  answer: "Take the test below: passing it skips what you already know.",
  finishReason: "stop",
  generatedAt: NOW.toISOString(),
  model: "google/gemini-3.8-flash",
  promptVersion: "goal-tutor-test",
  provider: "google",
  runId: "run-goal-tutor",
};

async function setup({ dailyMinutes = 12 }: { dailyMinutes?: number } = {}) {
  const user = await userFixture();

  const library = await planLibraryFixture({
    phases: ["Basics", "Deeper", "Practice"],
    skills: [
      { area: "English", lessons: 4, phase: 0 },
      { area: "English", lessons: 4, phase: 1 },
      { area: "Law", lessons: 1, phase: 2 },
    ],
  });

  const { goal } = await unplannedGoalFixture({
    dailyMinutes,
    settings: { startDate: "2020-09-28" },
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  return { goal, library, user };
}

const MOCK_AREAS = ["Mathematics", "Languages", "Philosophy"] as const;
const ASKED_FOR_MOCK = "I want to practice with a mock exam";

/** Each subject's questions: Philosophy's two are too few for a mock of its own. */
const MOCK_QUESTIONS: Record<(typeof MOCK_AREAS)[number], number> = {
  Languages: 8,
  Mathematics: 8,
  Philosophy: 2,
};

/** An exam of one day: a section for each of its subjects, with its questions. */
const MOCK_STRUCTURE = {
  formats: [],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "", method: "raw" },
    sections: MOCK_AREAS.map((name) => ({
      day: null,
      minutes: 12,
      name,
      questions: MOCK_QUESTIONS[name],
    })),
    timeLimitMinutes: 36,
    totalQuestions: 18,
  },
  rules: [],
  subjects: MOCK_AREAS.map((name) => ({
    citation: { passage: "From the notice.", sourceId: "source" },
    name,
    questions: MOCK_QUESTIONS[name],
    topics: [],
    weight: null,
  })),
};

/**
 * An exam goal whose plan has a skill in each of the notice's subjects: with the notice read
 * (`notice`), its mocks can be built; without it and with no questions in the bank, none can.
 */
async function examSetup({ notice = true, plus }: { notice?: boolean; plus: boolean }) {
  const [user, blueprint, skills] = await Promise.all([
    userFixture(),
    notice ? examBlueprintFixture({ structure: MOCK_STRUCTURE }) : null,
    Promise.all(MOCK_AREAS.map((area) => skillFixture({ name: `${area} ${randomUUID()}` }))),
  ]);

  const goal = await goalFixture({
    examBlueprintId: blueprint?.id ?? null,
    kind: "exam",
    timezone: "UTC",
    userId: user.id,
  });

  await Promise.all([
    planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "Basics" }],
        skills: skills.map((skill, index) => ({
          area: MOCK_AREAS[index] ?? "",
          lessons: 1,
          name: skill.name,
          phase: 0,
          skillId: skill.id,
          weight: null,
        })),
      },
    }),
    plus
      ? prisma.subscription.create({
          data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
        })
      : null,
  ]);

  mockSession(user.id);

  return { goal };
}

/** The learner asks the buddy something, and the answer's generation claims it. */
async function askBuddy(goalId: string, question = "The English lessons are too basic") {
  const created = await createLessonQuestion({
    input: { context: { kind: "plan" }, question, requestId: randomUUID() },
    target: { goalId, kind: "plan" },
  });

  if (created.status !== "created") {
    throw new Error(`Expected a created question, received ${created.status}`);
  }

  const claimed = await claimLessonQuestionAnswer({
    questionId: created.question.id,
    requestedModel: () => ANSWER_RUN.model,
  });

  if (claimed.status !== "ready") {
    throw new Error(`Expected a claimed answer, received ${claimed.status}`);
  }

  return { questionId: created.question.id, revision: claimed.claim.revision };
}

describe("app tools the buddy offers", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("offers the test of the area's next chapter and keeps it with the answer", async () => {
    const { goal, library } = await setup();
    const asked = await askBuddy(goal.id);

    const result = await offerTutorTool({ ...asked, area: "english", tool: "chapterTest" });

    expect(result).toMatchObject({
      offer: {
        chapterId: library.chapters[0]?.id,
        chapterTitle: library.chapters[0]?.title,
        goalId: goal.id,
        kind: "chapterTest",
      },
      status: "offered",
    });

    const lessonsLeft = result.status === "offered" && "lessonsLeft" in result.offer;
    expect(lessonsLeft).toBe(true);

    await completeLessonQuestionAnswer({ ...ANSWER_RUN, ...asked });

    const thread = await getLessonQuestionThread({
      contextKind: "plan",
      target: { goalId: goal.id, kind: "plan" },
    });

    expect(thread.status === "ready" ? thread.thread?.questions : null).toMatchObject([
      {
        answer: ANSWER_RUN.answer,
        toolOffer: { chapterId: library.chapters[0]?.id, kind: "chapterTest" },
      },
    ]);
  });

  it("says when a tool can't help now instead of offering it", async () => {
    const { goal } = await setup({ dailyMinutes: 120 });
    const asked = await askBuddy(goal.id);

    // Law's chapter has one lesson left: a test wouldn't skip enough to be worth it.
    await expect(
      offerTutorTool({ ...asked, area: "Law", tool: "chapterTest" }),
    ).resolves.toStrictEqual({ reason: "nothingToSkip", status: "unavailable" });

    // A plan without a date covers every subject in depth: there's no focus to choose.
    await expect(offerTutorTool({ ...asked, tool: "chooseFocus" })).resolves.toStrictEqual({
      reason: "everythingFits",
      status: "unavailable",
    });

    await expect(offerTutorTool({ ...asked, tool: "conversationCall" })).resolves.toStrictEqual({
      reason: "notLanguage",
      status: "unavailable",
    });

    await expect(
      prisma.lessonQuestion.findUniqueOrThrow({ where: { id: asked.questionId } }),
    ).resolves.toMatchObject({ toolOffer: null });
  });

  it("only lets the generation answering the learner's own question offer a tool", async () => {
    const { goal } = await setup();
    const other = await userFixture();
    const asked = await askBuddy(goal.id);

    await expect(
      offerTutorTool({ ...asked, revision: asked.revision - 1, tool: "chapterTest" }),
    ).resolves.toStrictEqual({ status: "notFound" });

    mockSession(other.id);

    await expect(offerTutorTool({ ...asked, tool: "chapterTest" })).resolves.toStrictEqual({
      status: "notFound",
    });

    mockSession(null);

    await expect(offerTutorTool({ ...asked, tool: "chapterTest" })).resolves.toStrictEqual({
      status: "unauthorized",
    });
  });

  it("offers choosing a mock to a learner whose plan includes mock exams, and keeps it", async () => {
    const { goal } = await examSetup({ plus: true });
    const asked = await askBuddy(goal.id, ASKED_FOR_MOCK);

    await expect(offerTutorTool({ ...asked, tool: "mockExam" })).resolves.toStrictEqual({
      offer: {
        access: "open",
        goalId: goal.id,
        kind: "mockExam",
        // Only the subjects with a mock of their own: Philosophy's two questions make none.
        subjects: ["Mathematics", "Languages"],
      },
      status: "offered",
    });

    await expect(
      prisma.lessonQuestion.findUniqueOrThrow({ where: { id: asked.questionId } }),
    ).resolves.toMatchObject({ toolOffer: { goalId: goal.id, kind: "mockExam" } });
  });

  it("offers a free learner's mock locked with what Plus unlocks, never hidden", async () => {
    const free = await examSetup({ plus: false });
    const freeAsked = await askBuddy(free.goal.id, ASKED_FOR_MOCK);

    await expect(offerTutorTool({ ...freeAsked, tool: "mockExam" })).resolves.toStrictEqual({
      offer: {
        access: "plusRequired",
        goalId: free.goal.id,
        kind: "mockExam",
        subjects: ["Mathematics", "Languages"],
      },
      status: "offered",
    });

    await expect(
      prisma.lessonQuestion.findUniqueOrThrow({ where: { id: freeAsked.questionId } }),
    ).resolves.toMatchObject({ toolOffer: { access: "plusRequired", kind: "mockExam" } });
  });

  it("never offers a mock that can't be taken: tests with nothing to build from and goals that aren't exams", async () => {
    // A class test with no material and no questions in the bank has no mock to take yet, even
    // with Plus.
    const unbuilt = await examSetup({ notice: false, plus: true });
    const unbuiltAsked = await askBuddy(unbuilt.goal.id, ASKED_FOR_MOCK);

    await expect(offerTutorTool({ ...unbuiltAsked, tool: "mockExam" })).resolves.toStrictEqual({
      reason: "noMock",
      status: "unavailable",
    });

    const { goal } = await setup();
    const learnAsked = await askBuddy(goal.id, ASKED_FOR_MOCK);

    await expect(offerTutorTool({ ...learnAsked, tool: "mockExam" })).resolves.toStrictEqual({
      reason: "notExam",
      status: "unavailable",
    });

    const saved = await prisma.lessonQuestion.findMany({
      select: { toolOffer: true },
      where: { id: { in: [unbuiltAsked, learnAsked].map((ask) => ask.questionId) } },
    });

    expect(saved).toStrictEqual([{ toolOffer: null }, { toolOffer: null }]);
  });
});

/** A published course of a brand, findable in the catalog by its own (unique) title. */
async function catalogCourseFixture(language: string) {
  const title = `Violão ${randomUUID().slice(0, 8)}`;
  const brand = await organizationFixture({ kind: "brand" });

  const course = await courseFixture({
    description: "Chords, rhythm and your first songs.",
    isPublished: true,
    language,
    normalizedTitle: normalizeString(title),
    organizationId: brand.id,
    title,
    visibility: "public",
  });

  return { brand, course, title };
}

describe("every feature the buddy can suggest", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts a new goal with the learner's words and the catalog's course, locked while the free plan follows one goal", async () => {
    const { goal } = await setup();
    const { brand, course, title } = await catalogCourseFixture(goal.language);
    const asked = await askBuddy(goal.id, "I also want to learn the guitar");

    await expect(
      offerTutorTool({
        ...asked,
        goalWords: "  Learn the guitar to play at church  ",
        tool: "startGoal",
        topic: title,
      }),
    ).resolves.toStrictEqual({
      offer: {
        access: "plusRequired",
        course: {
          brandSlug: brand.slug,
          description: course.description,
          id: course.id,
          imageUrl: null,
          slug: course.slug,
          title,
        },
        goal: "Learn the guitar to play at church",
        kind: "startGoal",
      },
      status: "offered",
    });

    await expect(
      prisma.lessonQuestion.findUniqueOrThrow({ where: { id: asked.questionId } }),
    ).resolves.toMatchObject({ toolOffer: { access: "plusRequired", kind: "startGoal" } });
  });

  it("starts a new goal openly with Plus, without a course when none matches, and never without words", async () => {
    const { goal } = await examSetup({ plus: true });
    const asked = await askBuddy(goal.id, "I want to study for another exam");

    await expect(
      offerTutorTool({
        ...asked,
        goalWords: "Pass the INSS concurso",
        tool: "startGoal",
        topic: `Nothing like this ${randomUUID()}`,
      }),
    ).resolves.toStrictEqual({
      offer: { access: "open", course: null, goal: "Pass the INSS concurso", kind: "startGoal" },
      status: "offered",
    });

    await completeLessonQuestionAnswer({ ...ANSWER_RUN, ...asked });
    const again = await askBuddy(goal.id, "Something else");

    await expect(
      offerTutorTool({ ...again, goalWords: " ", tool: "startGoal", topic: null }),
    ).resolves.toStrictEqual({ reason: "unavailable", status: "unavailable" });
  });

  it("opens the mistakes notebook while the goal has mistakes to fix", async () => {
    const { goal, library, user } = await setup();
    const asked = await askBuddy(goal.id, "I keep getting the same things wrong");

    await expect(offerTutorTool({ ...asked, tool: "mistakes" })).resolves.toStrictEqual({
      reason: "noMistakes",
      status: "unavailable",
    });

    const otherSkill = await skillFixture();
    const skillId = library.skills[0]?.id ?? null;

    await Promise.all([
      mistakeFixture({ skillId, userId: user.id }),
      mistakeFixture({ skillId, userId: user.id }),
      mistakeFixture({ skillId, status: "fixed", userId: user.id }),
      mistakeFixture({ skillId: otherSkill.id, userId: user.id }),
    ]);

    await completeLessonQuestionAnswer({ ...ANSWER_RUN, ...asked });
    const again = await askBuddy(goal.id, "Can I review my mistakes?");

    // Only this goal's open mistakes count: not fixed ones, not another subject's.
    await expect(offerTutorTool({ ...again, tool: "mistakes" })).resolves.toStrictEqual({
      offer: { goalId: goal.id, kind: "mistakes", open: 2 },
      status: "offered",
    });
  });

  it("says the words to say again for a language goal, and that other goals have none", async () => {
    const { goal } = await setup();
    const asked = await askBuddy(goal.id, "How do I improve my pronunciation?");

    await expect(offerTutorTool({ ...asked, tool: "pronunciation" })).resolves.toStrictEqual({
      reason: "notLanguage",
      status: "unavailable",
    });

    const learner = await userFixture();

    const language = await goalFixture({
      kind: "language",
      targetLanguage: "en",
      userId: learner.id,
    });

    await planFixture({
      goalId: language.id,
      graph: { phases: [{ milestone: null, name: "A1" }], skills: [] },
    });

    const organization = await organizationFixture();
    const word = await wordFixture({ organizationId: organization.id, targetLanguage: "en" });
    mockSession(learner.id);
    const languageAsked = await askBuddy(language.id, "I want to work on my pronunciation");

    await expect(
      offerTutorTool({ ...languageAsked, tool: "pronunciation" }),
    ).resolves.toStrictEqual({ reason: "nothingDue", status: "unavailable" });

    await Promise.all([
      pronunciationReviewFixture({
        dueAt: NOW,
        language: "en",
        userId: learner.id,
        wordId: word.id,
      }),
      completeLessonQuestionAnswer({ ...ANSWER_RUN, ...languageAsked }),
    ]);

    const again = await askBuddy(language.id, "Pronunciation practice?");

    await expect(offerTutorTool({ ...again, tool: "pronunciation" })).resolves.toStrictEqual({
      offer: { count: 1, goalId: language.id, kind: "pronunciation", words: [word.word] },
      status: "offered",
    });
  });

  it("opens the written test's page for an exam that has one, locked once a free plan's first days end", async () => {
    const { goal } = await setup();
    const asked = await askBuddy(goal.id, "I want to practise my essay");

    await expect(offerTutorTool({ ...asked, tool: "essay" })).resolves.toStrictEqual({
      reason: "notExam",
      status: "unavailable",
    });

    const exam = await examSetup({ plus: false });
    const examAsked = await askBuddy(exam.goal.id, "I want to practise my essay");

    await expect(offerTutorTool({ ...examAsked, tool: "essay" })).resolves.toStrictEqual({
      reason: "notWritten",
      status: "unavailable",
    });

    // ENEM-like: the notice has a redação with no questions, and the plan practises it.
    const learner = await userFixture();

    const [blueprint, essaySkill] = await Promise.all([
      examBlueprintFixture({
        structure: {
          ...MOCK_STRUCTURE,
          subjects: [
            ...MOCK_STRUCTURE.subjects,
            {
              citation: { passage: "From the notice.", sourceId: "source" },
              name: "Redação",
              questions: null,
              topics: [],
              weight: null,
            },
          ],
        },
      }),
      skillFixture({ name: `Redação ${randomUUID()}` }),
    ]);

    const written = await goalFixture({
      createdAt: new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000),
      examBlueprintId: blueprint.id,
      kind: "exam",
      timezone: "UTC",
      userId: learner.id,
    });

    await planFixture({
      goalId: written.id,
      graph: {
        phases: [{ milestone: null, name: "Basics" }],
        skills: [
          {
            area: "Redação",
            lessons: 1,
            name: essaySkill.name,
            outcome: true,
            phase: 0,
            skillId: essaySkill.id,
            weight: null,
          },
        ],
      },
    });

    mockSession(learner.id);
    const writtenAsked = await askBuddy(written.id, "I want to practise my essay");

    // A month in, the free plan's first days are over: the page is shown, locked.
    await expect(offerTutorTool({ ...writtenAsked, tool: "essay" })).resolves.toStrictEqual({
      offer: {
        access: "plusRequired",
        cadence: "weekly",
        goalId: written.id,
        kind: "essay",
        subject: "Redação",
        subjectKey: "redacao",
      },
      status: "offered",
    });
  });

  it("opens statistics, the week in review, memory and Plus, which every learner has", async () => {
    const { goal } = await setup();
    const asked = await askBuddy(goal.id, "How am I doing?");

    for (const kind of ["stats", "logbook", "memory"] as const) {
      // oxlint-disable-next-line no-await-in-loop -- one offer per answer, so each is asked in turn.
      await expect(offerTutorTool({ ...asked, tool: kind })).resolves.toStrictEqual({
        offer: { kind },
        status: "offered",
      });
    }

    await expect(offerTutorTool({ ...asked, tool: "plus" })).resolves.toStrictEqual({
      offer: { kind: "plus", subscribed: false },
      status: "offered",
    });

    const plus = await examSetup({ plus: true });
    const plusAsked = await askBuddy(plus.goal.id, "How do I cancel Plus?");

    await expect(offerTutorTool({ ...plusAsked, tool: "plus" })).resolves.toStrictEqual({
      offer: { kind: "plus", subscribed: true },
      status: "offered",
    });
  });
});

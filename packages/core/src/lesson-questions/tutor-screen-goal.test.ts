import { randomUUID } from "node:crypto";
import { interpretPlanEdit } from "@zoonk/ai/tasks/v2/plans/edit-intent";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import {
  setupPlayableLesson,
  stepOfKind,
} from "../lesson-player/_test-utils/playable-lesson-setup";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { claimLessonQuestionAnswer, completeLessonQuestionAnswer } from "./answer-lifecycle";
import { type LessonQuestionContextInput, type TutorTarget } from "./contract";
import { createLessonQuestion } from "./create-lesson-question";
import { getLessonQuestionThread } from "./get-lesson-question-thread";
import { proposeTutorPlanChange } from "./propose-tutor-plan-change";

/** Reading the learner's words is a model call; each test says what it understood. */
vi.mock("@zoonk/ai/tasks/v2/plans/edit-intent", () => ({ interpretPlanEdit: vi.fn() }));

/** A Monday in 2020, before the learning events other tests write, so estimates stay put. */
const NOW = new Date("2020-09-28T12:00:00Z");

const MODEL = "openai/gpt-6-luna";

const ANSWER_RUN = {
  answer: "Prepared it: tap Apply when you're ready.",
  finishReason: "stop",
  generatedAt: NOW.toISOString(),
  model: MODEL,
  promptVersion: "goal-tutor-test",
  provider: "openai",
  runId: "run-screen-buddy",
};

/** A goal with a built plan for a learner, whose first chapter the plan teaches. */
async function plannedGoal(userId: string) {
  const library = await planLibraryFixture({
    skills: [
      { area: "Research", lessons: 4 },
      { area: "Portfolio", lessons: 4 },
    ],
  });

  const { goal } = await unplannedGoalFixture({
    dailyMinutes: 12,
    settings: { startDate: "2020-09-28" },
    title: "Get a UX job",
    userId,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });

  const [chapter] = library.chapters;

  if (!chapter) {
    throw new Error("Expected the plan's chapter");
  }

  return { chapter, goal };
}

/** A learner's goal with a plan row and no lessons, for screens that read none of its lessons. */
async function goalWithEmptyPlan(userId: string) {
  const goal = await goalFixture({ title: "Get a UX job", userId });
  await planFixture({ goalId: goal.id, graph: { phases: [], skills: [] } });
  return goal;
}

/** The learner asks on a screen and the answer's generation claims the question. */
async function askAndClaim({
  context,
  question = "Can my portfolio case study start earlier?",
  target,
}: {
  context: LessonQuestionContextInput;
  question?: string;
  target: TutorTarget;
}) {
  const created = await createLessonQuestion({
    input: { context, question, requestId: randomUUID() },
    target,
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

  return { claim: claimed.claim, questionId: created.question.id };
}

/** The learner's words read as a rest day on Sundays, a change every plan can make. */
function mockRestDay() {
  vi.mocked(interpretPlanEdit).mockResolvedValue({
    data: {
      leftOut: [],
      operations: [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [0] }],
      summary: "Sundays stay free.",
      understood: true,
    },
    provenance: {
      generatedAt: NOW.toISOString(),
      latencyMs: 1,
      model: "google/gemini-3.5-flash-lite",
      promptVersion: "test",
      provider: "google",
      requestedModel: "google/gemini-3.5-flash-lite",
      runId: "run-plan-words",
      usage: {},
    },
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  });
}

describe("the buddy on a screen inside a goal", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads the learner's goal and plan with the chapter they asked from", async () => {
    const user = await userFixture();
    const { chapter, goal } = await plannedGoal(user.id);
    mockSession(user.id);

    const { claim } = await askAndClaim({
      context: { kind: "chapter" },
      target: { chapterId: chapter.id, kind: "chapter" },
    });

    expect(claim.analytics).toStrictEqual({ distinctId: user.id, goalId: goal.id });

    expect(claim.contextSnapshot).toMatchObject({
      goal: { title: "Get a UX job" },
      scope: { kind: "plan" },
      screen: { chapter: { title: chapter.title }, scope: { kind: "chapter" } },
      setup: { areas: [{ name: "Research" }, { name: "Portfolio" }] },
    });
  });

  it("proposes a plan change from a chapter's question, shown with that answer", async () => {
    const user = await userFixture();
    const { chapter, goal } = await plannedGoal(user.id);
    mockSession(user.id);
    mockRestDay();

    const target = { chapterId: chapter.id, kind: "chapter" } as const;
    const { claim, questionId } = await askAndClaim({ context: { kind: "chapter" }, target });
    const asked = { questionId, revision: claim.revision };

    const result = await proposeTutorPlanChange({ ...asked, request: "Sunday is a rest day" });
    await completeLessonQuestionAnswer({ ...ANSWER_RUN, ...asked });

    expect(result).toMatchObject({ status: "proposed" });

    const change = await prisma.planChange.findFirstOrThrow({
      where: { plan: { goalId: goal.id }, status: "proposed" },
    });

    const thread = await getLessonQuestionThread({ contextKind: "chapter", target });

    expect(thread).toMatchObject({
      status: "ready",
      thread: { questions: [{ id: questionId, planChange: { id: change.id } }] },
    });
  });

  it("reads the plan with the lesson screen a learner asks about", async () => {
    const { lesson, steps, user } = await setupPlayableLesson();
    const goal = await goalWithEmptyPlan(user.id);
    mockSession(user.id);
    const step = stepOfKind(steps, "explanation");

    const { claim } = await askAndClaim({
      context: { kind: "step", stepId: step.id, stepNumber: 2 },
      question: "Can I move this topic to next week?",
      target: { kind: "lesson", lessonId: lesson.id },
    });

    expect(claim.shareAnswer).toBe(false);

    expect(claim.contextSnapshot).toMatchObject({
      goal: { title: goal.title },
      scope: { kind: "plan" },
      screen: { lesson: { title: lesson.title }, scope: { kind: "step" } },
    });
  });

  it("saves the buddy's answer without em dashes, as the learner read it", async () => {
    const [user, chapter] = await Promise.all([userFixture(), libraryChapterFixture()]);
    mockSession(user.id);

    const target = { chapterId: chapter.id, kind: "chapter" } as const;
    const { claim, questionId } = await askAndClaim({ context: { kind: "chapter" }, target });

    await completeLessonQuestionAnswer({
      ...ANSWER_RUN,
      answer: "Dá para começar cedo, sim — e o sistema de matrícula é um bom caso.",
      questionId,
      revision: claim.revision,
    });

    const thread = await getLessonQuestionThread({ contextKind: "chapter", target });

    expect(thread).toMatchObject({
      thread: {
        questions: [
          { answer: "Dá para começar cedo, sim, e o sistema de matrícula é um bom caso." },
        ],
      },
    });
  });

  it("answers about a chapter alone for a learner without a goal, with no plan to change", async () => {
    const [user, chapter] = await Promise.all([userFixture(), libraryChapterFixture()]);
    mockSession(user.id);

    const { claim, questionId } = await askAndClaim({
      context: { kind: "chapter" },
      target: { chapterId: chapter.id, kind: "chapter" },
    });

    expect(claim.contextSnapshot).toMatchObject({
      chapter: { title: chapter.title },
      scope: { kind: "chapter" },
    });

    expect(claim.contextSnapshot).not.toHaveProperty("screen");

    await expect(
      proposeTutorPlanChange({
        questionId,
        request: "Sunday is a rest day",
        revision: claim.revision,
      }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });

  it("keeps everything the buddy reads from a saved question: the target's cut-off and when essays are practiced", async () => {
    const user = await userFixture();
    const { goal } = await plannedGoal(user.id);
    mockSession(user.id);

    const created = await createLessonQuestion({
      input: { context: { kind: "plan" }, question: "Where was the bar?", requestId: randomUUID() },
      target: { goalId: goal.id, kind: "plan" },
    });

    if (created.status !== "created") {
      throw new Error(`Expected a created question, received ${created.status}`);
    }

    const stored = await prisma.lessonQuestion.findUniqueOrThrow({
      where: { id: created.question.id },
    });

    const snapshot = stored.contextSnapshot as {
      goal: Record<string, unknown>;
      setup: Record<string, unknown>;
    };

    const cutoff = {
      edition: "2025",
      maxScore: 1000,
      quota: "Ampla concorrência",
      score: 742.5,
      source: "https://example.com/cutoffs",
      target: "Medicina, UFMG",
    };

    await prisma.lessonQuestion.update({
      data: {
        contextSnapshot: {
          ...snapshot,
          goal: { ...snapshot.goal, cutoff },
          setup: { ...snapshot.setup, writtenCadence: "biweekly" },
        },
      },
      where: { id: created.question.id },
    });

    const claimed = await claimLessonQuestionAnswer({
      questionId: created.question.id,
      requestedModel: MODEL,
    });

    expect(claimed).toMatchObject({
      claim: { contextSnapshot: { goal: { cutoff }, setup: { writtenCadence: "biweekly" } } },
      status: "ready",
    });
  });
});

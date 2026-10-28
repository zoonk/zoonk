import { randomUUID } from "node:crypto";
import { interpretPlanEdit } from "@zoonk/ai/tasks/v2/plans/edit-intent";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
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
import { lookUpTutorData } from "./look-up-tutor-data";
import { offerTutorTool } from "./offer-tutor-tool";
import { proposeTutorPlanChange } from "./propose-tutor-plan-change";

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

async function plannedGoal(userId: string, title = "Get a UX job") {
  const library = await planLibraryFixture({
    skills: [
      { area: "Research", lessons: 4 },
      { area: "Portfolio", lessons: 4 },
    ],
  });

  const { goal } = await unplannedGoalFixture({
    dailyMinutes: 12,
    settings: { startDate: "2020-09-28" },
    title,
    userId,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });

  const [chapter] = library.chapters;

  if (!chapter) {
    throw new Error("Expected the plan's chapter");
  }

  return { chapter, goal, skills: library.skills };
}

async function switchGoalsMidAnswer() {
  const user = await userFixture();

  const [asked, other] = await Promise.all([
    plannedGoal(user.id),
    plannedGoal(user.id, "Learn Figma"),
  ]);

  await learningProfileFixture({ activeGoalId: asked.goal.id, userId: user.id });
  mockSession(user.id);

  const { claim, questionId } = await askAndClaim({
    context: { kind: "chapter" },
    target: { chapterId: asked.chapter.id, kind: "chapter" },
  });

  await prisma.userLearningProfile.update({
    data: { activeGoalId: other.goal.id },
    where: { userId: user.id },
  });

  return { answering: { questionId, revision: claim.revision }, asked, other, user };
}

async function goalWithEmptyPlan(userId: string) {
  const goal = await goalFixture({ title: "Get a UX job", userId });
  await planFixture({ goalId: goal.id, graph: { phases: [], skills: [] } });
  return goal;
}

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

  it("looks up and changes the goal it was asked under when the learner opens another one mid-answer", async () => {
    mockRestDay();
    const { answering, asked, other } = await switchGoalsMidAnswer();

    await expect(
      lookUpTutorData({ ...answering, area: null, query: null, what: "goals" }),
    ).resolves.toMatchObject({
      goals: expect.arrayContaining([
        expect.objectContaining({ open: false, thisGoal: true, title: "Get a UX job" }),
        expect.objectContaining({ open: true, thisGoal: false, title: "Learn Figma" }),
      ]),
      status: "found",
    });

    await expect(
      proposeTutorPlanChange({ ...answering, request: "Sunday is a rest day" }),
    ).resolves.toMatchObject({ status: "proposed" });

    const [onAsked, onOther] = await Promise.all([
      prisma.planChange.count({ where: { plan: { goalId: asked.goal.id }, status: "proposed" } }),
      prisma.planChange.count({ where: { plan: { goalId: other.goal.id }, status: "proposed" } }),
    ]);

    expect({ onAsked, onOther }).toStrictEqual({ onAsked: 1, onOther: 0 });
  });

  it("offers the app's features for the goal it was asked under when the learner opens another one mid-answer", async () => {
    const { answering, asked, user } = await switchGoalsMidAnswer();
    const [skill] = asked.skills;

    if (!skill) {
      throw new Error("Expected the asked goal's skill");
    }

    await mistakeFixture({ skillId: skill.id, userId: user.id });

    await expect(offerTutorTool({ ...answering, tool: "mistakes" })).resolves.toStrictEqual({
      offer: { goalId: asked.goal.id, kind: "mistakes", open: 1 },
      status: "offered",
    });
  });

  it("gives the buddy's search the names the learner goes by, to keep them out of what it sends", async () => {
    const user = await userFixture({
      email: `ana.lima.${randomUUID()}@zoonk.test`,
      name: "Ana Lima",
    });

    const { chapter } = await plannedGoal(user.id);

    await learningProfileFixture({ buddyName: "Zu", userId: user.id });
    mockSession(user.id);

    const { claim } = await askAndClaim({
      context: { kind: "chapter" },
      target: { chapterId: chapter.id, kind: "chapter" },
    });

    expect(claim.learnerNames).toStrictEqual(
      expect.arrayContaining(["Ana Lima", user.email.split("@")[0], "Zu"]),
    );
  });

  it("marks the words of the learner's own private chapter as theirs, never a public chapter's", async () => {
    const user = await userFixture();
    const { chapter } = await plannedGoal(user.id);
    mockSession(user.id);

    const target = { chapterId: chapter.id, kind: "chapter" } as const;
    const onPublic = await askAndClaim({ context: { kind: "chapter" }, target });

    expect(onPublic.claim.contextSnapshot).toMatchObject({ privateContent: false });

    await completeLessonQuestionAnswer({
      ...ANSWER_RUN,
      questionId: onPublic.questionId,
      revision: onPublic.claim.revision,
    });

    await prisma.chapter.update({
      data: { ownerId: user.id, visibility: "private" },
      where: { id: chapter.id },
    });

    const onOwn = await askAndClaim({
      context: { kind: "chapter" },
      question: "And here?",
      target,
    });

    expect(onOwn.claim.contextSnapshot).toMatchObject({ privateContent: true });
  });

  it("reads a question saved before its Library text was marked as private", async () => {
    const user = await userFixture();
    const { chapter } = await plannedGoal(user.id);
    mockSession(user.id);

    const created = await createLessonQuestion({
      input: { context: { kind: "chapter" }, question: "And here?", requestId: randomUUID() },
      target: { chapterId: chapter.id, kind: "chapter" },
    });

    if (created.status !== "created") {
      throw new Error(`Expected a created question, received ${created.status}`);
    }

    const questionId = created.question.id;

    await prisma.$executeRaw`
      UPDATE lesson_questions SET context_snapshot = context_snapshot - 'privateContent'
      WHERE id = ${questionId}::uuid`;

    const claimed = await claimLessonQuestionAnswer({ questionId, requestedModel: MODEL });

    expect(claimed).toMatchObject({ claim: { contextSnapshot: { privateContent: true } } });
  });

  it("marks a plan built from the learner's own private course", async () => {
    const user = await userFixture();
    const { chapter, goal } = await plannedGoal(user.id);
    const course = await courseFixture({ userId: user.id, visibility: "private" });

    await prisma.goal.update({ data: { primaryCourseId: course.id }, where: { id: goal.id } });
    mockSession(user.id);

    const { claim } = await askAndClaim({
      context: { kind: "chapter" },
      target: { chapterId: chapter.id, kind: "chapter" },
    });

    expect(claim.contextSnapshot).toMatchObject({ privateContent: true });
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

    await plannedGoal(user.id);
    const answering = { questionId, revision: claim.revision };

    await expect(
      proposeTutorPlanChange({ ...answering, request: "Sunday is a rest day" }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await expect(
      lookUpTutorData({ ...answering, area: null, query: null, what: "goals" }),
    ).resolves.toStrictEqual({ status: "notFound", what: "goals" });
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

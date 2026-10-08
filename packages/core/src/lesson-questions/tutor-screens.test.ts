import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import {
  catalogCourseFixture,
  privateCourseFixture,
} from "@zoonk/testing/fixtures/library-courses";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../_test-utils/deferred-work";
import { mockSession } from "../_test-utils/mock-session";
import { trackServerEvent } from "../analytics/server";
import { startMock } from "../exams/mocks/start-mock";
import { submitMockSection } from "../exams/mocks/submit-mock-section";
import { updateMemoryFromActivity } from "../memory/update-memory-from-activity";
import {
  SESSION_NOW,
  SESSION_TODAY,
  checkpointItemFixture,
  sessionGoalFixture,
} from "../sessions/_test-utils/session-goal";
import { getTodayStudySession } from "../sessions/get-today-study-session";
import { parseLessonQuestionContextSnapshot } from "./_utils/context-snapshot-schema";
import {
  claimLessonQuestionAnswer,
  completeLessonQuestionAnswer,
  rememberLessonQuestionAnswer,
} from "./answer-lifecycle";
import { type LessonQuestionContextInput, type TutorTarget } from "./contract";
import { createLessonQuestion } from "./create-lesson-question";
import { getLessonQuestion } from "./get-lesson-question";
import { getLessonQuestionThread } from "./get-lesson-question-thread";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

// PostHog is an external service; the mock records what would leave the server.
vi.mock("../analytics/server", () => ({ trackServerEvent: vi.fn() }));

/** A missed mock question's cause and memory extraction call models; their modules test them. */
vi.mock("@zoonk/ai/tasks/v2/mistakes/cause", () => ({ classifyMistakeCause: vi.fn() }));
vi.mock("../memory/update-memory-from-activity", () => ({ updateMemoryFromActivity: vi.fn() }));

const ANSWER_RUN = {
  answer: "It builds on the chapter before.",
  finishReason: "stop",
  generatedAt: "2026-09-27T12:00:00.000Z",
  model: "openai/gpt-6-luna",
  promptVersion: "lesson-question-test",
  provider: "openai",
  runId: "run-screen-question",
};

async function ask({
  context,
  question = "What will I be able to do after this?",
  target,
}: {
  context: LessonQuestionContextInput;
  question?: string;
  target: TutorTarget;
}) {
  return createLessonQuestion({ input: { context, question, requestId: randomUUID() }, target });
}

async function askCreated(input: Parameters<typeof ask>[0]) {
  const result = await ask(input);

  if (result.status !== "created") {
    throw new Error(`Expected a created question, received ${result.status}`);
  }

  return result.question;
}

async function storedSnapshot(questionId: string) {
  const stored = await prisma.lessonQuestion.findUniqueOrThrow({ where: { id: questionId } });
  return parseLessonQuestionContextSnapshot(stored.contextSnapshot);
}

describe("the tutor beyond lessons", () => {
  beforeEach(() => {
    vi.mocked(updateMemoryFromActivity).mockResolvedValue([]);
    mockSession(null);
  });

  it("asks about a chapter with its lessons and the ones the learner finished", async () => {
    const [user, { chapters, lessons }] = await Promise.all([
      userFixture(),
      catalogCourseFixture({ lessonCounts: [2] }),
    ]);

    const [chapter] = chapters;
    const [finished, next] = lessons[0] ?? [];

    if (!chapter || !finished || !next) {
      throw new Error("Expected a chapter with two lessons");
    }

    await learningEventFixture({ contentIds: { lessonId: finished.id }, userId: user.id });
    mockSession(user.id);
    const flush = runDeferredWork();

    const target = { chapterId: chapter.id, kind: "chapter" } as const;
    const question = await askCreated({ context: { kind: "chapter" }, target });
    await flush();

    expect(question).toMatchObject({ context: { kind: "chapter" }, status: "pending" });

    await expect(storedSnapshot(question.id)).resolves.toMatchObject({
      chapter: { objectives: chapter.objectives, title: chapter.title },
      lessons: [
        { finished: true, title: finished.title },
        { finished: false, title: next.title },
      ],
      scope: { kind: "chapter" },
    });

    expect(trackServerEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Tutor Asked",
        properties: { chapter_id: chapter.id, scope: "chapter" },
      }),
    );

    await expect(
      prisma.lessonQuestionThread.findMany({ where: { userId: user.id } }),
    ).resolves.toMatchObject([{ chapterId: chapter.id, kind: "chapter", libraryLessonId: null }]);

    await expect(getLessonQuestionThread({ target })).resolves.toMatchObject({
      status: "ready",
      thread: { lessonId: null, questions: [{ id: question.id }] },
    });

    await expect(getLessonQuestion({ questionId: question.id })).resolves.toMatchObject({
      question: { id: question.id },
      status: "ready",
    });
  });

  it("asks about the learner's own private chapters and keeps other learners' hidden", async () => {
    const [user, other] = await Promise.all([userFixture(), userFixture()]);

    const [own, theirs] = await Promise.all([
      privateCourseFixture({ ownerId: user.id }),
      privateCourseFixture({ ownerId: other.id }),
    ]);

    mockSession(user.id);
    const context = { kind: "chapter" } as const;

    const [ownResult, theirsResult] = await Promise.all([
      ask({ context, target: { chapterId: own.chapters[0]?.id ?? "", kind: "chapter" } }),
      ask({ context, target: { chapterId: theirs.chapters[0]?.id ?? "", kind: "chapter" } }),
    ]);

    expect(ownResult.status).toBe("created");
    expect(theirsResult).toStrictEqual({ status: "notFound" });
  });

  it("refuses a context that isn't about the thread's subject", async () => {
    const [user, { chapters }] = await Promise.all([userFixture(), catalogCourseFixture()]);
    const target = { chapterId: chapters[0]?.id ?? "", kind: "chapter" } as const;
    mockSession(user.id);

    const results = await Promise.all([
      ask({ context: { kind: "lesson" }, target }),
      ask({ context: { kind: "plan" }, target }),
    ]);

    expect(results).toStrictEqual([{ status: "invalidContext" }, { status: "invalidContext" }]);

    await expect(
      prisma.lessonQuestion.count({ where: { thread: { userId: user.id } } }),
    ).resolves.toBe(0);
  });

  describe("with the learner's plan and mock", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(SESSION_NOW);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("explains today's plan and its course from why each item is there, only to its owner", async () => {
      const [user, other, { course }] = await Promise.all([
        userFixture(),
        userFixture(),
        catalogCourseFixture({ lessonCounts: [2, 1] }),
      ]);

      const { goal } = await sessionGoalFixture({
        goal: { primaryCourseId: course.id },
        userId: user.id,
      });

      mockSession(user.id);

      await getTodayStudySession({ goalId: goal.id });

      const target = { goalId: goal.id, kind: "plan" } as const;

      const question = await askCreated({
        context: { kind: "plan" },
        question: "Why am I studying this today?",
        target,
      });

      const snapshot = await storedSnapshot(question.id);

      // One "Ask" on the plan answers about its course too, from the course's outline: its
      // chapters' titles level by level, which every message sends, so no lesson lists.
      expect(snapshot).toMatchObject({
        course: {
          levels: [{ chapters: ["Chapter 1", "Chapter 2"], level: "beginner" }],
          title: course.title,
        },
        goal: { title: goal.title },
        scope: { kind: "plan" },
        today: { date: "2026-09-30", source: "session" },
      });

      const reasons = "today" in snapshot ? snapshot.today?.items.map((item) => item.reason) : [];
      expect(reasons).toContain("newSkill");

      mockSession(other.id);

      await expect(ask({ context: { kind: "plan" }, target })).resolves.toStrictEqual({
        status: "notFound",
      });
    });

    it("keeps the mock exams a free plan doesn't include in the days ahead, marked as Plus", async () => {
      const [free, plus] = await Promise.all([userFixture(), userFixture()]);
      const tomorrow = new Date(SESSION_TODAY.getTime() + MS_PER_DAY);

      async function kindsAhead({ isPlus, userId }: { isPlus: boolean; userId: string }) {
        const { goal, plan } = await sessionGoalFixture({ goal: { kind: "exam" }, userId });

        await Promise.all([
          checkpointItemFixture({
            kind: "mock",
            planId: plan.id,
            position: 10,
            scheduledFor: tomorrow,
          }),
          isPlus
            ? prisma.subscription.create({
                data: { plan: "plus", provider: "zoonk", referenceId: userId, status: "active" },
              })
            : null,
        ]);

        mockSession(userId);

        const question = await askCreated({
          context: { kind: "plan" },
          question: "What's coming this week?",
          target: { goalId: goal.id, kind: "plan" },
        });

        const snapshot = await storedSnapshot(question.id);
        const next = "next" in snapshot ? snapshot.next : [];

        return next.flatMap((day) => day.items.filter((item) => item.kind === "mock"));
      }

      // Features are never hidden: the buddy sees the free plan's mock too, and that it's Plus's.
      await expect(kindsAhead({ isPlus: false, userId: free.id })).resolves.toStrictEqual([
        expect.objectContaining({ kind: "mock", plusRequired: true }),
      ]);

      await expect(kindsAhead({ isPlus: true, userId: plus.id })).resolves.toStrictEqual([
        expect.not.objectContaining({ plusRequired: true }),
      ]);
    });

    it("answers about a mock only once it's finished, from its result", async () => {
      const user = await userFixture();
      const blueprint = await examBlueprintFixture();

      const { goal, plan } = await sessionGoalFixture({
        goal: { examBlueprintId: blueprint.id, kind: "exam" },
        userId: user.id,
      });

      await Promise.all([
        checkpointItemFixture({
          kind: "mock",
          planId: plan.id,
          position: 10,
          scheduledFor: SESSION_TODAY,
        }),
        prisma.subscription.create({
          data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
        }),
      ]);

      mockSession(user.id);

      const today = await getTodayStudySession({ goalId: goal.id });
      const blockId = today.status === "ready" ? (today.session.blocks.at(-1)?.id ?? "") : "";
      const target = { blockId, kind: "mock" } as const;

      await startMock({ blockId, input: {} });

      // No help with an exam that's still running.
      await expect(ask({ context: { kind: "mock" }, target })).resolves.toStrictEqual({
        status: "notFound",
      });

      await submitMockSection({ blockId, input: {}, section: 0 });

      const question = await askCreated({
        context: { kind: "mock" },
        question: "What should I practice first?",
        target,
      });

      const snapshot = await storedSnapshot(question.id);

      expect(snapshot).toMatchObject({
        exam: { number: 1 },
        result: { blank: expect.any(Number), estimate: null },
        scope: { kind: "mock" },
      });

      const missed = "missed" in snapshot ? snapshot.missed : [];

      expect(missed.length).toBeGreaterThan(0);
      expect(missed.every((entry) => entry.skill !== null)).toBe(true);
    });
  });

  it("answers a screen question with the learner's memory and remembers the exchange", async () => {
    const [user, { chapters }] = await Promise.all([userFixture(), catalogCourseFixture()]);
    const chapterId = chapters[0]?.id ?? "";
    mockSession(user.id);

    const question = await askCreated({
      context: { kind: "chapter" },
      target: { chapterId, kind: "chapter" },
    });

    const claimed = await claimLessonQuestionAnswer({
      questionId: question.id,
      requestedModel: ANSWER_RUN.model,
    });

    expect(claimed).toMatchObject({
      claim: { learnerMemory: [], priorTurns: [], shareAnswer: false },
      status: "ready",
    });

    const revision = claimed.status === "ready" ? claimed.claim.revision : 0;

    await expect(
      completeLessonQuestionAnswer({ ...ANSWER_RUN, questionId: question.id, revision }),
    ).resolves.toStrictEqual({ status: "updated" });

    await expect(rememberLessonQuestionAnswer({ questionId: question.id })).resolves.toStrictEqual(
      [],
    );

    expect(updateMemoryFromActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        source: expect.objectContaining({ id: question.id, language: "en" }),
      }),
    );
  });
});

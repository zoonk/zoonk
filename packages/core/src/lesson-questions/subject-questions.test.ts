import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../_test-utils/deferred-work";
import { mockSession } from "../_test-utils/mock-session";
import { trackServerEvent } from "../analytics/server";
import { updateMemoryFromActivity } from "../memory/update-memory-from-activity";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { parseLessonQuestionContextSnapshot } from "./_utils/context-snapshot-schema";
import { type LessonQuestionContextInput, type TutorTarget } from "./contract";
import { createLessonQuestion } from "./create-lesson-question";
import { getLessonQuestion } from "./get-lesson-question";
import { getLessonQuestionThread } from "./get-lesson-question-thread";

vi.mock("../memory/update-memory-from-activity", () => ({ updateMemoryFromActivity: vi.fn() }));

/** A learner whose plan teaches two modules, ecology (two lessons) and genetics (one). */
async function plannedLearner() {
  const user = await userFixture();

  const library = await planLibraryFixture({
    skills: [
      { area: "Ecologia", lessons: 2 },
      { area: "Genética", lessons: 1 },
    ],
  });

  const { goal } = await unplannedGoalFixture({ kind: "learn", timezone: "UTC", userId: user.id });

  mockSession(user.id);
  await createGoalPlan({ goalId: goal.id, graph: library.graph });

  return { goal, user };
}

function ask({
  context = { kind: "subject" },
  target,
}: {
  context?: LessonQuestionContextInput;
  target: TutorTarget;
}) {
  return createLessonQuestion({
    input: { context, question: "What's left in this subject?", requestId: randomUUID() },
    target,
  });
}

describe("asking the buddy about a subject", () => {
  beforeEach(() => {
    vi.mocked(updateMemoryFromActivity).mockResolvedValue([]);
    mockSession(null);
  });

  it("asks with the subject's topics and chapters beside the goal's plan, in its own thread", async () => {
    const { goal, user } = await plannedLearner();
    const flush = runDeferredWork();
    const target = { goalId: goal.id, kind: "subject", subjectKey: "ecologia" } as const;

    const result = await ask({ target });
    await flush();

    expect(result).toMatchObject({
      question: { context: { kind: "subject" }, status: "pending" },
      status: "created",
    });

    const questionId = result.status === "created" ? result.question.id : "";
    const stored = await prisma.lessonQuestion.findUniqueOrThrow({ where: { id: questionId } });

    // The buddy reads the goal's plan, and the subject's page as the screen it was asked from.
    expect(parseLessonQuestionContextSnapshot(stored.contextSnapshot)).toMatchObject({
      goal: { title: goal.title },
      scope: { kind: "plan" },
      screen: {
        chapters: [{ lessonsDone: 0, lessonsTotal: 2 }],
        scope: { kind: "subject" },
        subject: { lessonsDone: 0, lessonsTotal: 2, name: "Ecologia", source: "plan" },
      },
    });

    expect(trackServerEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Tutor Asked",
        properties: { goal_id: goal.id, scope: "subject", subject_key: "ecologia" },
      }),
    );

    // One thread per subject, apart from the plan's own conversation.
    await expect(
      prisma.lessonQuestionThread.findMany({ where: { userId: user.id } }),
    ).resolves.toMatchObject([
      { goalId: null, kind: "subject", subjectGoalId: goal.id, subjectKey: "ecologia" },
    ]);

    await expect(getLessonQuestionThread({ target })).resolves.toMatchObject({
      status: "ready",
      thread: { lessonId: null, questions: [{ id: questionId }] },
    });

    await expect(
      getLessonQuestionThread({ target: { ...target, subjectKey: "genetica" } }),
    ).resolves.toStrictEqual({ status: "ready", thread: null });

    await expect(
      getLessonQuestionThread({ target: { goalId: goal.id, kind: "plan" } }),
    ).resolves.toStrictEqual({ status: "ready", thread: null });

    await expect(getLessonQuestion({ questionId })).resolves.toMatchObject({
      question: { id: questionId },
      status: "ready",
    });
  });

  it("keeps subjects the goal doesn't have, other learners' goals and other contexts out", async () => {
    const [{ goal }, stranger] = await Promise.all([plannedLearner(), userFixture()]);
    const target = { goalId: goal.id, kind: "subject", subjectKey: "ecologia" } as const;

    mockSession(null);
    await expect(ask({ target })).resolves.toStrictEqual({ status: "unauthorized" });

    mockSession(goal.userId);

    await expect(ask({ target: { ...target, subjectKey: "fisica" } })).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(ask({ context: { kind: "plan" }, target })).resolves.toStrictEqual({
      status: "invalidContext",
    });

    mockSession(stranger.id);

    await expect(ask({ target })).resolves.toStrictEqual({ status: "notFound" });

    await expect(getLessonQuestionThread({ target })).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(
      prisma.lessonQuestion.count({ where: { thread: { subjectGoalId: goal.id } } }),
    ).resolves.toBe(0);
  });
});

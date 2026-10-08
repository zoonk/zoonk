import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { contentFeedbackFixture, feedbackFixture } from "@zoonk/testing/fixtures/feedback";
import { goalFixture, planChangeFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import {
  guardianLinkFixture,
  learningProfileFixture,
} from "@zoonk/testing/fixtures/learning-profiles";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { memoryFactFixture, milestoneFixture } from "@zoonk/testing/fixtures/memory";
import { userProgressFixture } from "@zoonk/testing/fixtures/progress";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { exportCurrentUserData } from "./export-current-user-data";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

/** A question the learner asked their buddy about their goal, with its answer. */
async function buddyQuestionFixture({ goalId, userId }: { goalId: string; userId: string }) {
  const thread = await prisma.lessonQuestionThread.create({
    data: { goalId, kind: "plan", userId },
  });

  return prisma.lessonQuestion.create({
    data: {
      answer: "Start with the subjects that weigh most.",
      contextKind: "plan",
      contextSnapshot: {},
      model: "test/tutor-model",
      promptVersion: "test-tutor-prompt",
      question: "Where should I start?",
      requestFingerprint: randomUUID(),
      requestId: randomUUID(),
      runId: "test-tutor-run",
      status: "completed",
      threadId: thread.id,
    },
  });
}

/** A line a lesson wrote for the learner from their memory. */
async function exampleLineFixture(userId: string) {
  const lesson = await libraryLessonFixture({ contentStatus: "completed" });
  const step = await libraryStepFixture({ lessonId: lesson.id });

  return prisma.stepExampleLine.create({
    data: {
      contextKey: "facts-hash",
      model: "test/example-model",
      promptVersion: "test",
      runId: randomUUID(),
      stepId: step.id,
      text: "At the pharmacy where you work, 25% off saves R$ 10.",
      userId,
    },
  });
}

/** A learner with something in every part of the export. */
async function createLearnerWithData() {
  const user = await userFixture();
  const goal = await goalFixture({ title: "Pass ENEM", userId: user.id });
  const plan = await planFixture({ goalId: goal.id });

  await Promise.all([
    buddyQuestionFixture({ goalId: goal.id, userId: user.id }),
    exampleLineFixture(user.id),
    studySessionFixture({ goalId: goal.id, userId: user.id }),
    usageRecordsFixture({ costMicros: 1200, count: 1, userId: user.id }),
    learningProfileFixture({ buddyKind: "otto", memoryEnabled: true, userId: user.id }),
    planChangeFixture({ planId: plan.id, reason: "Added a lesson on fractions" }),
    userProgressFixture({ totalBrainPower: 1234n, userId: user.id }),
    learningEventFixture({ userId: user.id }),
    attemptFixture({ userId: user.id }),
    mistakeFixture({ userId: user.id }),
    milestoneFixture({ userId: user.id }),
    memoryFactFixture({ statement: "Wants Law at a public university", userId: user.id }),
    contentFeedbackFixture({ contentId: randomUUID(), userId: user.id, vote: "down" }),
    feedbackFixture({ email: user.email, message: "Loving the new plan", userId: user.id }),
    guardianLinkFixture({ guardianEmail: "parent@zoonk.test", userId: user.id }),
  ]);

  return { goal, user };
}

describe(exportCurrentUserData, () => {
  it("requires a signed-in learner", async () => {
    mockSession(null);
    await expect(exportCurrentUserData()).resolves.toBeNull();
  });

  it("exports everything Zoonk keeps about the learner, without secrets", async () => {
    const { goal, user } = await createLearnerWithData();
    mockSession(user.id);

    const data = await exportCurrentUserData();

    expect(data).toMatchObject({
      account: { email: user.email, name: user.name },
      answers: { attempts: [expect.objectContaining({ userId: user.id })] },
      buddy: {
        conversations: [
          expect.objectContaining({
            goalId: goal.id,
            kind: "plan",
            questions: [
              expect.objectContaining({
                answer: "Start with the subjects that weigh most.",
                question: "Where should I start?",
              }),
            ],
          }),
        ],
        exampleLines: [
          expect.objectContaining({ text: "At the pharmacy where you work, 25% off saves R$ 10." }),
        ],
      },
      feedback: {
        contentVotes: [expect.objectContaining({ vote: "down" })],
        messages: [expect.objectContaining({ message: "Loving the new plan" })],
      },
      goals: [
        {
          id: goal.id,
          plan: { changes: [expect.objectContaining({ reason: "Added a lesson on fractions" })] },
          title: "Pass ENEM",
        },
      ],
      guardianLinks: [expect.objectContaining({ guardianEmail: "parent@zoonk.test" })],
      learnerModel: {
        milestones: [expect.objectContaining({ userId: user.id })],
        mistakes: [expect.objectContaining({ userId: user.id })],
      },
      memory: {
        enabled: true,
        facts: [expect.objectContaining({ statement: "Wants Law at a public university" })],
      },
      profile: { buddy: { kind: "otto" } },
      progress: {
        learningEvents: [expect.objectContaining({ userId: user.id })],
        totals: { totalBrainPower: 1234 },
      },
      study: { sessions: [expect.objectContaining({ goalId: goal.id })] },
      usage: [expect.objectContaining({ kind: "lessonStart" })],
    });

    expect(data?.guardianLinks[0]).not.toHaveProperty("tokenHash");
    // How a row was made and what it cost Zoonk are ours, not the learner's.
    expect(data?.buddy.conversations[0]?.questions[0]).not.toHaveProperty("model");
    expect(data?.buddy.exampleLines[0]).not.toHaveProperty("runId");
    expect(data?.usage[0]).not.toHaveProperty("costMicros");
    expect(() => JSON.stringify(data)).not.toThrow();
  });

  it("never includes another learner's data", async () => {
    const [{ user: other }, reader] = await Promise.all([createLearnerWithData(), userFixture()]);
    mockSession(reader.id);

    const data = await exportCurrentUserData();

    expect(JSON.stringify(data)).not.toContain(other.id);

    expect(data).toMatchObject({
      account: { email: reader.email },
      buddy: { conversations: [], exampleLines: [] },
      goals: [],
      memory: { facts: [] },
      study: { sessions: [] },
      usage: [],
    });
  });
});

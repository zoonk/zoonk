import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseRows } from "@zoonk/testing/statement-counter";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { type readSavedPlan } from "../learner/facts/saved-plan";
import { sessionGoalFixture } from "./_test-utils/session-goal";
import { getStudySessionSummary } from "./get-study-session-summary";

vi.mock("../learner/facts/saved-plan", async (importOriginal) => {
  const [actual, { keepRequestReads }] = await Promise.all([
    importOriginal<{ readSavedPlan: typeof readSavedPlan }>(),
    import("../_test-utils/keep-request-reads"),
  ]);

  return { ...actual, readSavedPlan: keepRequestReads(actual.readSavedPlan) };
});

describe("a stopped session's summary reads", () => {
  it("reads the goal's saved plan once", async () => {
    const user = await userFixture();
    const { goal, lessons } = await sessionGoalFixture({ userId: user.id });
    const [done, waiting] = lessons;

    const session = await studySessionFixture({
      goalId: goal.id,
      status: "active",
      stoppedAt: new Date(),
      userId: user.id,
    });

    await Promise.all([
      studySessionBlockFixture({
        completedAt: new Date(),
        lessonId: done?.id,
        payload: { title: done?.title },
        position: 0,
        sessionId: session.id,
        status: "completed",
      }),
      studySessionBlockFixture({
        lessonId: waiting?.id,
        payload: { title: waiting?.title },
        position: 1,
        sessionId: session.id,
      }),
    ]);

    mockSession(user.id);

    const reads = await countDatabaseRows(
      () => getStudySessionSummary({ input: {}, sessionId: session.id }),
      'FROM "public"."plans" WHERE ("public"."plans"."goal_id" = $1',
    );

    expect(reads.result.status).toBe("ready");
    expect(reads.rows).toBe(1);
  });
});

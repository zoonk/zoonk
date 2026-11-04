import { prisma } from "@zoonk/db";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { countDatabaseRows } from "@zoonk/testing/statement-counter";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { describe, expect, it, vi } from "vitest";
import { mockAccountSession } from "../_test-utils/mock-session";
import { findGoalStartLimit } from "../entitlements/find-goal-start-limit";
import { listCurrentUserGoals } from "../goals/list-current-user-goals";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { type readActiveSubscription } from "../learner/facts/subscription";
import { getLearnerSummary } from "../learner/summary/get-learner-summary";
import { getBuddyStatus } from "../milestones/get-buddy-status";
import { getWeeklyRecap } from "../milestones/get-weekly-recap";
import { getStudySessionSummary } from "../sessions/get-study-session-summary";
import { signedInCourseGoal } from "./_test-utils/course-goal";
import { getChapterView } from "./chapter/get-chapter-view";
import { getFieldMapView } from "./map/get-field-map-view";
import { getTodayView } from "./today/get-today-view";

vi.mock("../learner/facts/subscription", async (importOriginal) => {
  const [actual, { keepRequestReads }] = await Promise.all([
    importOriginal<{ readActiveSubscription: typeof readActiveSubscription }>(),
    import("../_test-utils/keep-request-reads"),
  ]);

  return { ...actual, readActiveSubscription: keepRequestReads(actual.readActiveSubscription) };
});

const SUBSCRIPTION_ROWS = 'FROM "public"."subscriptions"';

async function subscribe(user: Parameters<typeof mockAccountSession>[0]["user"]) {
  await prisma.subscription.create({
    data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
  });

  mockAccountSession({ user });
}

async function plusLanguageLearner() {
  const fixture = await languageGoalFixture();
  await subscribe(fixture.user);
  return fixture;
}

describe("a Plus learner's page reads", () => {
  it("reads the subscription once for a language Plan's map, goal list and summary", async () => {
    const { goal } = await plusLanguageLearner();

    const reads = await countDatabaseRows(
      () =>
        Promise.all([
          getFieldMapView({ goalId: goal.id }),
          listCurrentUserGoals(),
          getLearnerSummary(),
        ]),
      SUBSCRIPTION_ROWS,
    );

    const [map, list, summary] = reads.result;

    expect({
      goals: list?.goals.map((view) => view.id),
      map: map.status,
      tier: summary?.tier,
    }).toStrictEqual({ goals: [goal.id], map: "ready", tier: "plus" });

    expect(reads.rows).toBe(1);
  });

  it("reads it once for a language goal's unopened Today", async () => {
    await plusLanguageLearner();

    const reads = await countDatabaseRows(
      () => Promise.all([getTodayView({}), listCurrentUserGoals(), getLearnerSummary()]),
      SUBSCRIPTION_ROWS,
    );

    const [today] = reads.result;

    expect(today.status === "ready" && today.today.session.status).toBe("unstarted");
    expect(reads.rows).toBe(1);
  });

  it("reads it once for the buddy's saved day", async () => {
    const { goal, user } = await plusLanguageLearner();

    await studySessionFixture({
      goalId: goal.id,
      localDate: getDateInTimeZone({ date: new Date(), timeZone: getAnswerTimeZone({ goal }) }),
      userId: user.id,
    });

    const reads = await countDatabaseRows(
      () => Promise.all([getBuddyStatus({}), getLearnerSummary()]),
      SUBSCRIPTION_ROWS,
    );

    const [buddy] = reads.result;

    expect(buddy.status === "ready" && buddy.buddy.today?.goalId).toBe(goal.id);
    expect(reads.rows).toBe(1);
  });

  it("reads it once for the start page, where Plus leaves room for another goal", async () => {
    await plusLanguageLearner();

    const reads = await countDatabaseRows(
      () => Promise.all([findGoalStartLimit(), getLearnerSummary()]),
      SUBSCRIPTION_ROWS,
    );

    expect(reads.result[0]).toBeNull();
    expect(reads.rows).toBe(1);
  });

  it("reads it once for an exam chapter and the summary", async () => {
    const { chapters, goal, user } = await signedInCourseGoal();
    await prisma.goal.update({ data: { kind: "exam" }, where: { id: goal.id } });
    await subscribe(user);

    const reads = await countDatabaseRows(
      () =>
        Promise.all([getChapterView({ chapterId: chapters[0]?.id ?? "" }), getLearnerSummary()]),
      SUBSCRIPTION_ROWS,
    );

    const [chapter] = reads.result;

    expect(chapter.status).toBe("ready");
    expect(reads.rows).toBe(1);
  });

  it("reads it once for an exam goal's weekly recap and the summary", async () => {
    const { goal, user } = await signedInCourseGoal();
    await prisma.goal.update({ data: { kind: "exam" }, where: { id: goal.id } });
    await subscribe(user);

    const reads = await countDatabaseRows(
      () => Promise.all([getWeeklyRecap({ goalId: goal.id }), getLearnerSummary()]),
      SUBSCRIPTION_ROWS,
    );

    const [recap] = reads.result;

    expect(recap.status).toBe("ready");
    expect(reads.rows).toBe(1);
  });

  it("reads it once for an unfinished exam session's summary", async () => {
    const { goal, user } = await signedInCourseGoal();
    await prisma.goal.update({ data: { kind: "exam" }, where: { id: goal.id } });
    await subscribe(user);
    const session = await studySessionFixture({ goalId: goal.id, userId: user.id });

    const reads = await countDatabaseRows(
      () =>
        Promise.all([
          getStudySessionSummary({ input: {}, sessionId: session.id }),
          getLearnerSummary(),
        ]),
      SUBSCRIPTION_ROWS,
    );

    const [summary] = reads.result;

    expect(summary.status).toBe("ready");
    expect(reads.rows).toBe(1);
  });
});

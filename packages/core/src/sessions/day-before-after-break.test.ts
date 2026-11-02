import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { getTodayStudySession } from "./_test-utils/open-today";
import { readBlockPayload } from "./block-payload";
import { getStudySessionSummary } from "./get-study-session-summary";

const TODAY = new Date("2026-10-02T00:00:00Z");
const DAY_MS = 86_400_000;
const TEST_IN_DAYS = 7;

const TOPICS = 8;

function day(offset: number): Date {
  return new Date(TODAY.getTime() + offset * DAY_MS);
}

function setClock(offset: number) {
  const now = new Date(day(offset).getTime() + 12 * 60 * 60 * 1000);

  vi.setSystemTime(now);

  vi.mocked(getRequestProgressDateContext).mockResolvedValue({
    currentDate: day(offset),
    currentInstant: now,
    timeZone: "UTC",
  });
}

async function openToday(goalId: string) {
  const today = await getTodayStudySession({ goalId, timeZone: "UTC" });

  if (today.status !== "ready") {
    throw new Error(`Expected today's session, got ${today.status}`);
  }

  return today.session;
}

async function comeBackTheDayBefore() {
  const user = await userFixture();

  const [blueprint, library] = await Promise.all([
    examBlueprintFixture({
      name: "Cell biology test",
      ownerId: user.id,
      structure: { formats: [], mock: null, rules: [], subjects: [] },
      visibility: "private",
    }),
    planLibraryFixture({
      skills: Array.from({ length: TOPICS }, (_, index) => ({
        area: "Cell biology",
        lessons: 2,
        weight: index < 2 ? 4 : 2,
      })),
    }),
  ]);

  const { goal } = await unplannedGoalFixture({
    dailyMinutes: 25,
    details: { placementDeclined: true },
    examBlueprintId: blueprint.id,
    kind: "exam",
    targetDate: day(TEST_IN_DAYS),
    timezone: "UTC",
    userId: user.id,
  });

  await Promise.all([
    ...library.skills.flatMap((skill) =>
      [0, 1, 2].map(() => itemFixture({ content: choiceItemContent(), skillId: skill.id })),
    ),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  mockSession(user.id);
  await createGoalPlan({ goalId: goal.id, graph: library.graph });

  const first = await openToday(goal.id);
  const studied = first.blocks.find((block) => block.kind === "learn");

  await Promise.all([
    prisma.planItem.update({
      data: { completedAt: day(0), status: "done" },
      where: { id: studied?.planItemId ?? "" },
    }),
    prisma.studySession.update({ data: { status: "completed" }, where: { id: first.id } }),
    dailyProgressFixtureMany([{ date: day(0), timeSpentSeconds: 600, userId: user.id }]),
  ]);

  setClock(TEST_IN_DAYS - 1);

  return {
    goal,
    session: await openToday(goal.id),
    skillIds: library.skills.map((skill) => skill.id),
  };
}

describe("a class test's day before after skipped days", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    setClock(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is a full review of every topic, counting the lessons he skipped without pushing them, and ends without a lesson for tomorrow", async () => {
    const { session, skillIds } = await comeBackTheDayBefore();
    const review = session.blocks.find((block) => block.fullReview);

    expect(session.blocks.map((block) => block.kind)).not.toContain("learn");
    expect(review).toMatchObject({ kind: "practice" });

    const reviewBlock = await prisma.studySessionBlock.findUniqueOrThrow({
      where: { id: review?.id },
    });

    expect(new Set(readBlockPayload(reviewBlock).skillIds)).toStrictEqual(new Set(skillIds));

    expect(session.examTomorrow).toBe(true);
    expect(session.catchUp?.later.lessons).toBeGreaterThan(0);
    expect(session.catchUp?.later.minutes).toBeGreaterThan(25 * 1.25);
    expect(session.catchUp?.later.offered).toBe(false);

    const summary = await getStudySessionSummary({
      input: { timeZone: "UTC" },
      sessionId: session.id,
    });

    expect(summary.status === "ready" && summary.summary.tomorrow).toBeNull();
  });
});

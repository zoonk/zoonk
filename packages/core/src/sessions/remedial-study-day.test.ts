import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { attemptFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { FREE_LESSON_LIMIT } from "../entitlements/limits";
import { completeLibraryLesson } from "../lesson-player/complete-library-lesson";
import { startLibraryLesson } from "../lesson-player/start-library-lesson";
import { getSecondTakeIdentityKey } from "../library/second-takes/second-take-identity";
import { readPlanSummary } from "../plans/_utils/plan-summary";
import {
  SESSION_NOW,
  SESSION_TODAY,
  daysAgo,
  sessionGoalFixture,
} from "./_test-utils/session-goal";
import { loadDayPlan } from "./_utils/day-plan";
import { loadDayRemediation } from "./_utils/load-day-remediation";
import { selectDayPlan } from "./_utils/selected-day-plan";
import { readBlockPayload } from "./block-payload";
import { getSessionPageView } from "./get-session-page-view";
import { openStudyDay } from "./open-study-day";

async function withRecentMisses({ dated = false, replay }: { dated?: boolean; replay: boolean }) {
  const user = await userFixture();

  const fixture = await sessionGoalFixture({
    challengesDone: true,
    goal: { targetDate: dated ? daysAgo(-30) : null },
    itemsPerSkill: 8,
    userId: user.id,
  });

  const [original] = fixture.lessons;
  const [skill] = fixture.skills;
  const [first, last] = fixture.items;

  if (!original || !skill || !first || !last) {
    throw new Error("Session fixture did not create lessons and questions");
  }

  await Promise.all([
    prisma.lesson.update({
      data: { contentStatus: "completed", estimatedMinutes: 3 },
      where: { id: original.id },
    }),
    prisma.planItem.updateMany({
      data: { completedAt: daysAgo(12), status: "done" },
      where: { lessonId: original.id, planId: fixture.plan.id },
    }),
    learningEventFixture({
      contentIds: { lessonId: original.id },
      endedAt: daysAgo(12),
      kind: replay ? "review" : "lesson",
      userId: user.id,
    }),
    ...[first, last].map((item, index) =>
      attemptFixture({
        answeredAt: daysAgo(2 - index),
        cause: "gap",
        evidence: "independent",
        isCorrect: false,
        itemId: item.id,
        skillId: skill.id,
        userId: user.id,
      }),
    ),
  ]);

  mockSession(user.id);

  const context = {
    goal: fixture.goal,
    localDate: SESSION_TODAY,
    now: SESSION_NOW,
    timeZone: "UTC",
    userId: user.id,
  };

  return { ...fixture, context, first, last, original, skill, userId: user.id };
}

const layout = ({
  kind,
  lessonId,
  minutes,
  scheduledFor,
  status,
}: {
  kind: string;
  lessonId: string | null;
  minutes?: number | null;
  scheduledFor: Date | null;
  status: string;
}) => ({ kind, lessonId, minutes: minutes ?? null, scheduledFor, status });

describe("adaptive study days", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("freezes the assigned mistakes when the day opens and keeps the plan's items", async () => {
    const { context, first, goal, last, plan, skill, userId } = await withRecentMisses({
      replay: false,
    });

    const ready = await mistakeFixture({
      createdAt: daysAgo(2),
      itemId: first.id,
      skillId: skill.id,
      userId,
    });

    const input = { goalId: goal.id, shownDate: "2026-09-30", timeZone: "UTC" };

    const readItems = () =>
      prisma.planItem.findMany({ orderBy: { position: "asc" }, where: { planId: plan.id } });

    const selected = await selectDayPlan(context);
    const plannedItems = selected?.items;

    const opened = await openStudyDay(input);
    expect(opened.status).toBe("opened");

    if (opened.status !== "opened") {
      return;
    }

    const assignment = await prisma.studySessionBlock.findFirstOrThrow({
      orderBy: { position: "asc" },
      where: { sessionId: opened.sessionId },
    });

    expect(readBlockPayload(assignment).mistakeIds).toStrictEqual([ready.id]);

    await mistakeFixture({ createdAt: daysAgo(3), itemId: last.id, skillId: skill.id, userId });
    const again = await openStudyDay(input);
    expect(again).toMatchObject({ created: false, sessionId: opened.sessionId, status: "opened" });

    const frozen = await prisma.studySessionBlock.findUniqueOrThrow({
      where: { id: assignment.id },
    });

    expect(readBlockPayload(frozen).mistakeIds).toStrictEqual([ready.id]);

    const [finalItems, storedPlan] = await Promise.all([
      readItems(),
      prisma.plan.findUniqueOrThrow({ where: { id: plan.id } }),
    ]);

    expect(finalItems.map((item) => layout(item))).toStrictEqual(
      plannedItems?.map((item) => layout(item)),
    );

    const summary = readPlanSummary({ plan: { ...storedPlan, userId }, value: storedPlan.summary });
    expect(summary?.selected.coverage).toStrictEqual(selected?.summary?.coverage);
    expect(summary?.selected.endDate).toBe(selected?.summary?.endDate);

    expect(
      finalItems.filter((item) => item.kind === "lesson" && item.status === "todo"),
    ).toHaveLength(
      plannedItems?.filter((item) => item.kind === "lesson" && item.status === "todo").length ?? 0,
    );
  });

  it("owes one second take on POST and lists it only once written and startable", async () => {
    const { context, goal, skill, userId } = await withRecentMisses({ replay: true });
    const input = { goalId: goal.id, shownDate: "2026-09-30", timeZone: "UTC" };
    const owed = () => prisma.followUp.findMany({ where: { kind: "writeSecondTake", userId } });
    const read = async () => loadDayRemediation({ context, plan: await loadDayPlan(context) });

    await getSessionPageView(input);
    await expect(owed()).resolves.toStrictEqual([]);
    await expect(openStudyDay(input)).resolves.toMatchObject({ status: "opened" });
    await expect(openStudyDay(input)).resolves.toMatchObject({ created: false, status: "opened" });

    await expect(owed()).resolves.toMatchObject([
      { input: { skillId: skill.id, userId }, revision: 0 },
    ]);

    const retake = await libraryLessonFixture({
      estimatedMinutes: 4,
      identityKey: getSecondTakeIdentityKey({ ownerId: null, skillId: skill.id }),
    });

    await lessonSkillFixture({ lessonId: retake.id, skillId: skill.id });
    await expect(read()).resolves.toMatchObject({ teaching: [] });

    await Promise.all([
      libraryStepFixture({ kind: "summary", lessonId: retake.id }),
      prisma.lesson.update({ data: { contentStatus: "completed" }, where: { id: retake.id } }),
    ]);

    await expect(read()).resolves.toMatchObject({
      teaching: [{ lessonId: retake.id, payload: { returning: "anotherWay" } }],
    });

    await prisma.usageRecord.createMany({
      data: Array.from({ length: FREE_LESSON_LIMIT }, () => ({
        countedAt: SESSION_NOW,
        createdAt: SESSION_NOW,
        kind: "lessonStart",
        targetId: randomUUID(),
        userId,
      })),
    });

    await expect(read()).resolves.toMatchObject({ teaching: [] });
  });

  it("completes a returning block without checking off a plan lesson", async () => {
    const user = await userFixture();
    const { goal, planItems } = await sessionGoalFixture({ userId: user.id });
    const { lesson } = await playableLessonFixture({ steps: ["summary"] });
    const item = planItems[0];

    if (!item) {
      throw new Error("Session fixture did not create a plan item");
    }

    await prisma.planItem.update({ data: { lessonId: lesson.id }, where: { id: item.id } });

    await learningEventFixture({
      contentIds: { lessonId: lesson.id },
      endedAt: daysAgo(3),
      userId: user.id,
    });

    const session = await studySessionFixture({
      goalId: goal.id,
      localDate: SESSION_TODAY,
      userId: user.id,
    });

    const block = await studySessionBlockFixture({
      kind: "learn",
      lessonId: lesson.id,
      payload: { returning: "again" },
      sessionId: session.id,
    });

    mockSession(user.id);

    const started = await startLibraryLesson({ input: { timeZone: "UTC" }, lessonId: lesson.id });
    expect(started.status).toBe("started");

    if (started.status !== "started") {
      return;
    }

    await expect(
      completeLibraryLesson({
        input: { runId: started.run.runId, timeZone: "UTC" },
        lessonId: lesson.id,
      }),
    ).resolves.toMatchObject({ status: "completed" });

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
    ).resolves.toMatchObject({ status: "completed" });

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: item.id } }),
    ).resolves.toMatchObject({ status: "todo" });
  });
});

import { prisma } from "@zoonk/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AHEAD_START } from "./_test-utils/ahead-plan";
import {
  declineProposals,
  pacedPlanFixture,
  readTodayChange,
  studyEveryLesson,
  writeLessons,
} from "./_test-utils/estimate-plan";
import { parsePlanChangePayload } from "./_utils/plan-change-payload";
import { loadPlanContext } from "./_utils/plan-context";
import { computePlan } from "./_utils/replan";
import { getSeenEffect } from "./_utils/seen-effect";
import { countLessons } from "./_utils/stand-in-lessons";
import { decidePlanChange } from "./decide-plan-change";
import { refreshGoalPlan } from "./refresh-goal-plan";

/** Keep the source at own while the next session moves its blended factor. */
async function saveOwnPace({ factor, planId }: { factor: number; planId: string }) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });

  await prisma.plan.update({
    data: { settings: { ...(plan.settings as object), pace: { factor, source: "own" } } },
    where: { id: planId },
  });
}

async function previewChange(goalId: string) {
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
  const context = await loadPlanContext({ goal });

  if (!context) {
    throw new Error("The plan isn't built.");
  }

  const computed = await computePlan({ context, mode: "automatic", pace: "sampled" });
  return getSeenEffect({ computed, shown: context.items });
}

async function latestChange(planId: string) {
  const change = await prisma.planChange.findFirst({
    orderBy: { createdAt: "desc" },
    where: { kind: { in: ["coverageChanged", "estimateUpdated"] }, planId, status: "applied" },
  });

  return change ? { ...change, ...parsePlanChangePayload(change.payload) } : null;
}

describe("notices for changes within an estimate", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AHEAD_START);
  });

  afterEach(() => vi.useRealTimers());

  it.each([
    { seconds: 60, speed: "faster" },
    { seconds: 600, speed: "slower" },
  ])("announces an own-pace drift that makes lessons fit $speed", async ({ seconds, speed }) => {
    // Two weeks: an automatic run honestly keeps this week, and on an 8-day plan the final
    // challenge (C2) took the only day left after it; two weeks keep the multi-lesson growth.
    const fixture = {
      dailyMinutes: speed === "faster" ? 15 : 30,
      days: 14,
      lessons: speed === "faster" ? 4 : 6,
      skills: speed === "faster" ? 12 : 8,
    };

    const { goal, plan, user } = await pacedPlanFixture(fixture);

    // Faster: the plan starts short on time, with lessons left out a faster pace can bring in;
    // slower: it starts whole, so a slower pace can only leave lessons out.
    const planned = await prisma.planItem.count({ where: { kind: "lesson", planId: plan.id } });
    expect(planned < fixture.skills * fixture.lessons).toBe(speed === "faster");

    await saveOwnPace({ factor: 1, planId: plan.id });

    await studyEveryLesson({ planId: plan.id, seconds, userId: user.id });
    await refreshGoalPlan({ goalId: goal.id, pace: "sampled" });
    await declineProposals({ goalId: goal.id, planId: plan.id });

    const change = await latestChange(plan.id);
    const more = (change?.effect?.lessonsAdded ?? 0) - (change?.effect?.lessonsRemoved ?? 0);
    expect(speed === "faster" ? more : -more).toBeGreaterThan(1);
    const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    const beforeReads = await prisma.planChange.findMany({ where: { planId: plan.id } });

    await expect(readTodayChange(goal.id)).resolves.toMatchObject({
      canUndo: false,
      id: change?.id,
    });

    await readTodayChange(goal.id);

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toStrictEqual(
      saved,
    );

    await expect(prisma.planChange.findMany({ where: { planId: plan.id } })).resolves.toStrictEqual(
      beforeReads,
    );

    await refreshGoalPlan({ goalId: goal.id, pace: "sampled" });

    await expect(
      prisma.planChange.count({
        where: { kind: { in: ["coverageChanged", "estimateUpdated"] }, planId: plan.id },
      }),
    ).resolves.toBe(1);

    if (!change) {
      throw new Error("The change wasn't recorded.");
    }

    await decidePlanChange({ changeId: change.id, goalId: goal.id, input: { status: "seen" } });
    await expect(readTodayChange(goal.id)).resolves.toBeNull();
  });

  it.each([false, true])(
    "keeps a one-lesson sampled change quiet (already own: %s)",
    async (own) => {
      // 22 minutes: at 20, the 5% slower pace this week's kept work spilled past Sunday cost two
      // lessons once each phase's challenge took its 15 minutes (C2), not the one this asks about.
      const { goal, plan, user } = await pacedPlanFixture({
        dailyMinutes: 22,
        days: 14,
        lessons: 6,
        skills: 8,
      });

      if (own) {
        await saveOwnPace({ factor: 1, planId: plan.id });
      }

      await studyEveryLesson({ planId: plan.id, seconds: 195, userId: user.id });
      const seen = await previewChange(goal.id);
      expect(seen.lessonsRemoved - seen.lessonsAdded).toBe(1);
      expect(seen.topicsLeftOut).toBeUndefined();
      await refreshGoalPlan({ goalId: goal.id, pace: "sampled" });
      await declineProposals({ goalId: goal.id, planId: plan.id });
      await expect(latestChange(plan.id)).resolves.toBeNull();
      await expect(readTodayChange(goal.id)).resolves.toBeNull();
    },
  );

  it.each([
    { estimatedMinutes: 1, length: "shorter" },
    { estimatedMinutes: 10, length: "longer" },
  ])(
    "announces stand-ins resized by $length written lessons",
    async ({ estimatedMinutes, length }) => {
      const { goal, library, plan } = await pacedPlanFixture({
        dailyMinutes: 30,
        days: 14,
        lessons: 6,
        skills: 8,
        standIns: [4, 5],
      });

      await writeLessons({
        chapterId: library.chapters[2]?.id ?? "",
        estimatedMinutes,
        skills: library.skills.slice(4, 6),
      });

      await refreshGoalPlan({ goalId: goal.id });
      await declineProposals({ goalId: goal.id, planId: plan.id });

      const change = await latestChange(plan.id);
      const more = (change?.effect?.lessonsAdded ?? 0) - (change?.effect?.lessonsRemoved ?? 0);
      expect(length === "shorter" ? more : -more).toBeGreaterThan(1);

      await expect(readTodayChange(goal.id)).resolves.toMatchObject({
        canUndo: false,
        id: change?.id,
      });
    },
  );

  it("announces the net change when written lessons and pace each leave lessons out", async () => {
    const { goal, library, plan, user } = await pacedPlanFixture({
      dailyMinutes: 30,
      days: 14,
      lessons: 6,
      skills: 8,
      standIns: [4, 5],
    });

    await saveOwnPace({ factor: 1, planId: plan.id });
    await studyEveryLesson({ planId: plan.id, seconds: 600, userId: user.id });

    await writeLessons({
      chapterId: library.chapters[2]?.id ?? "",
      estimatedMinutes: 10,
      skills: library.skills.slice(4, 6),
    });

    await refreshGoalPlan({ goalId: goal.id, pace: "sampled" });
    await declineProposals({ goalId: goal.id, planId: plan.id });
    const change = await latestChange(plan.id);
    expect(change?.effect?.lessonsRemoved).toBeGreaterThan(1);

    await expect(readTodayChange(goal.id)).resolves.toMatchObject({
      canUndo: false,
      id: change?.id,
    });
  });

  it("keeps a one-lesson written resize quiet", async () => {
    const { goal, library, plan } = await pacedPlanFixture({
      dailyMinutes: 30,
      days: 14,
      lessons: 6,
      skills: 8,
      standIns: [4],
    });

    await writeLessons({
      chapterId: library.chapters[2]?.id ?? "",
      estimatedMinutes: 3,
      lessonCount: 5,
      skills: library.skills.slice(4, 5),
    });

    const seen = await previewChange(goal.id);
    expect(seen.lessonsAdded - seen.lessonsRemoved).toBe(1);
    expect(seen.topicsAdded).toBeUndefined();
    expect(seen.topicsLeftOut).toBeUndefined();
    await refreshGoalPlan({ goalId: goal.id });
    await declineProposals({ goalId: goal.id, planId: plan.id });
    await expect(latestChange(plan.id)).resolves.toBeNull();
    await expect(readTodayChange(goal.id)).resolves.toBeNull();
  });

  it("announces written lesson counts on an undated plan too", async () => {
    const { goal, library, plan } = await pacedPlanFixture({
      dailyMinutes: 30,
      days: null,
      lessons: 6,
      skills: 8,
      standIns: [4, 5],
    });

    await writeLessons({
      chapterId: library.chapters[2]?.id ?? "",
      estimatedMinutes: 3,
      skills: library.skills.slice(4, 6),
    });

    await refreshGoalPlan({ goalId: goal.id });
    await declineProposals({ goalId: goal.id, planId: plan.id });
    const change = await latestChange(plan.id);
    expect(goal.targetDate).toBeNull();
    expect(change?.effect?.lessonsAdded).toBe(8);
    expect(change?.effect?.lessonsRemoved).toBe(0);

    await expect(readTodayChange(goal.id)).resolves.toMatchObject({
      canUndo: false,
      id: change?.id,
      kind: "estimateUpdated",
    });
  });

  it("records written lessons added after the exam in the total count", async () => {
    const { goal, library, plan } = await pacedPlanFixture({
      dailyMinutes: 15,
      days: 14,
      fullCourse: true,
      kind: "exam",
      lessons: 4,
      skills: 8,
      standIns: [6, 7],
    });

    const before = await prisma.planItem.findMany({
      where: { kind: "lesson", planId: plan.id, status: "todo" },
    });

    const byDate = (items: typeof before) =>
      countLessons(
        items.filter(
          (item) =>
            item.scheduledFor !== null &&
            goal.targetDate !== null &&
            item.scheduledFor <= goal.targetDate,
        ),
      );

    await writeLessons({
      chapterId: library.chapters[3]?.id ?? "",
      estimatedMinutes: 3,
      skills: library.skills.slice(6, 8),
    });

    await refreshGoalPlan({ goalId: goal.id });
    await declineProposals({ goalId: goal.id, planId: plan.id });

    const after = await prisma.planItem.findMany({
      where: { kind: "lesson", planId: plan.id, status: "todo" },
    });

    const change = await latestChange(plan.id);
    expect(after.filter((item) => item.lessonId !== null)).toHaveLength(40);
    expect(after.filter((item) => item.lessonId === null)).toHaveLength(0);
    expect(countLessons(after) - countLessons(before)).toBe(8);
    expect(byDate(after)).toBe(byDate(before));
    expect(change?.effect?.lessonsAdded).toBe(8);
    // The last lessons reclaim time no longer set aside for an omitted after-exam mock.
    expect(change?.effect?.endDateAfter).toBe("2020-10-30");

    await expect(readTodayChange(goal.id)).resolves.toMatchObject({
      canUndo: false,
      id: change?.id,
      kind: "estimateUpdated",
    });
  });

  it.each([4, 5])(
    "announces a changed count of written lessons (%s-minute lessons)",
    async (estimatedMinutes) => {
      const { goal, library, plan } = await pacedPlanFixture({
        dailyMinutes: 30,
        days: 14,
        lessons: 6,
        skills: 8,
        standIns: [4, 5],
      });

      await writeLessons({
        chapterId: library.chapters[2]?.id ?? "",
        estimatedMinutes,
        skills: library.skills.slice(4, 6),
      });

      await refreshGoalPlan({ goalId: goal.id });
      await declineProposals({ goalId: goal.id, planId: plan.id });
      const change = await latestChange(plan.id);
      expect(change?.effect?.lessonsAdded).toBeGreaterThan(change?.effect?.lessonsRemoved ?? 0);
    },
  );

  it.each([178, 184])(
    "recognizes partially written stand-ins while the own pace drifts (%s seconds)",
    async (seconds) => {
      const { goal, library, plan, user } = await pacedPlanFixture({
        dailyMinutes: 30,
        days: 28,
        lessons: 6,
        own: true,
        partialStandIns: [4, 5],
        skills: 8,
      });

      await studyEveryLesson({ planId: plan.id, seconds, userId: user.id });
      const beforeWritten = await previewChange(goal.id);
      expect(beforeWritten.lessonsAdded - beforeWritten.lessonsRemoved).toBe(0);

      await writeLessons({
        chapterId: library.chapters[2]?.id ?? "",
        estimatedMinutes: 1,
        skills: library.skills.slice(4, 6),
      });

      await refreshGoalPlan({ goalId: goal.id, pace: "sampled" });
      await declineProposals({ goalId: goal.id, planId: plan.id });
      const change = await latestChange(plan.id);
      expect(change?.effect?.lessonsAdded).toBeGreaterThan(1);

      await expect(readTodayChange(goal.id)).resolves.toMatchObject({
        canUndo: false,
        id: change?.id,
      });
    },
  );
});

import { prisma } from "@zoonk/db";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getChallengeTimings } from "../checkpoints/_utils/challenge-timing";
import { getChallenge } from "../checkpoints/get-challenge";
import { markLearnerChanged } from "../learner/_utils/mark-learner-changed";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { getItemKey } from "../plans/planner/plan-items";
import { parsePlanSettings } from "../plans/planner/plan-state";
import { sessionGoalFixture } from "./_test-utils/session-goal";
import { planStudyDay } from "./_utils/plan-study-day";
import { selectDayPlan } from "./_utils/selected-day-plan";
import { answerStudyQuestion } from "./answer-study-question";
import { readBlockPayload } from "./block-payload";
import { finishStudyBlock } from "./finish-study-block";
import { openStudyDay } from "./open-study-day";
import { startStudyBlock } from "./start-study-block";

const START = new Date("2026-09-28T12:00:00Z");
const NOW = new Date("2026-09-30T12:00:00Z");
const TODAY = new Date("2026-09-30");

describe("a selected review day", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(START);
  });

  afterEach(() => vi.useRealTimers());

  it.each([
    ["the past review", "review", new Date("2026-09-29")],
    ["today's unfunded mock", "mock", TODAY],
  ] as const)(
    "offers a reached challenge today when missed lessons make Start move %s",
    async (_, kind, scheduledFor) => {
      const user = await userFixture();

      const fixture = await sessionGoalFixture({
        goal: { kind: "exam", targetDate: new Date("2026-10-04") },
        userId: user.id,
      });

      await prisma.planItem.updateMany({
        data: { completedAt: START, status: "done" },
        where: { id: { in: [fixture.planItems[0]!.id, fixture.planItems[1]!.id] } },
      });

      const boss = await planItemFixture({
        facts: {
          boss: {
            kind: "text",
            minutes: 10,
            questions: 10,
            testedKeys: [],
            testedSkillIds: [fixture.skills[0]!.id],
            waiting: false,
          },
          minutes: 10,
          parts: { checkpoint: 10, practice: 0, unwritten: 0, written: 0 },
          schemaVersion: 1,
          skillIds: [],
        },
        kind: "boss",
        planId: fixture.plan.id,
        position: 3,
        scheduledFor: new Date("2026-10-02"),
      });

      await prisma.planItem.update({
        data: { phase: 1, position: 10, scheduledFor: new Date("2026-09-28") },
        where: { id: fixture.planItems[2]!.id },
      });

      await planItemFixture({ kind, planId: fixture.plan.id, position: 4, scheduledFor });

      vi.setSystemTime(NOW);
      mockSession(user.id);

      const saved = await prisma.plan.findUniqueOrThrow({
        include: { items: { orderBy: { position: "asc" } } },
        where: { id: fixture.plan.id },
      });

      const selection = await selectDayPlan({ goal: fixture.goal, now: NOW, timeZone: "UTC" });

      if (!selection) {
        throw new Error("Expected the saved plan");
      }

      const planned = await planStudyDay({
        goal: fixture.goal,
        localDate: TODAY,
        now: NOW,
        selection,
        timeZone: "UTC",
        userId: user.id,
      });

      const today = {
        checkpointInToday: planned.blocks.some(
          (block) => block.kind === "checkpoint" && readBlockPayload(block).planItemId === boss.id,
        ),
        selectionHasEvent: selection.items.some((item) => item.kind === kind),
      };

      const plan = getChallengeTimings({
        goal: fixture.goal,
        items: saved.items,
        settings: parsePlanSettings(saved.settings),
        today: TODAY,
      }).get(boss.id)?.when;

      await learningProfileFixture({ activeGoalId: fixture.goal.id, userId: user.id });
      const read = await getChallenge({ input: { timeZone: "UTC" }, planItemId: boss.id });

      const screen =
        read.status === "ready"
          ? { date: read.challenge.date, status: read.challenge.status }
          : read.status;

      expect({ plan, screen, today }).toStrictEqual({
        plan: "nextSession",
        screen: { date: null, status: "ready" },
        today: { checkpointInToday: true, selectionHasEvent: false },
      });
    },
  );

  it("keeps a retained overdue review out of today's phase challenge offer", async () => {
    const user = await userFixture();

    const fixture = await sessionGoalFixture({
      goal: { kind: "exam", targetDate: new Date("2026-10-04") },
      userId: user.id,
    });

    await prisma.planItem.updateMany({
      data: { completedAt: START, status: "done" },
      where: { planId: fixture.plan.id },
    });

    const boss = await planItemFixture({
      facts: {
        boss: {
          kind: "text",
          minutes: 10,
          questions: 10,
          testedKeys: [],
          testedSkillIds: [fixture.skills[0]!.id],
          waiting: false,
        },
        minutes: 10,
        parts: { checkpoint: 10, practice: 0, unwritten: 0, written: 0 },
        schemaVersion: 1,
        skillIds: [],
      },
      kind: "boss",
      planId: fixture.plan.id,
      position: fixture.planItems.length + 1,
      scheduledFor: new Date("2026-10-02"),
    });

    const review = await planItemFixture({
      kind: "review",
      planId: fixture.plan.id,
      position: boss.position + 1,
      scheduledFor: new Date("2026-09-29"),
    });

    vi.setSystemTime(NOW);
    mockSession(user.id);
    const selection = await selectDayPlan({ goal: fixture.goal, now: NOW, timeZone: "UTC" });

    if (!selection) {
      throw new Error("Expected the retained plan");
    }

    expect(selection.items.find((item) => item.id === review.id)).toMatchObject({
      scheduledFor: new Date("2026-09-29"),
      status: "todo",
    });

    const planned = await planStudyDay({
      goal: fixture.goal,
      localDate: TODAY,
      now: NOW,
      selection,
      timeZone: "UTC",
      userId: user.id,
    });

    expect(planned.input.reviewPlanItemId).toBe(review.id);
    expect(planned.blocks.some((block) => block.kind === "checkpoint")).toBe(false);

    expect(
      getChallengeTimings({
        goal: fixture.goal,
        items: selection.items,
        settings: selection.state.settings,
        today: TODAY,
      }).get(boss.id),
    ).toStrictEqual({ date: "2026-10-01", when: "date" });
  });

  it("keeps review-day behavior and binds its practice to the review saved by Open", async () => {
    const user = await userFixture();
    const library = await planLibraryFixture({ skills: [{ lessons: 6 }] });

    const fixture = await unplannedGoalFixture({
      dailyMinutes: 15,
      kind: "exam",
      settings: { startDate: "2026-09-28" },
      targetDate: new Date("2026-10-01"),
      timezone: "UTC",
      userId: user.id,
    });

    await createGoalPlan({ goalId: fixture.goal.id, graph: library.graph });

    await Promise.all([
      learnerSkillFixture({
        due: new Date("2026-10-10"),
        lastReviewedAt: START,
        reps: 2,
        skillId: library.skills[0]!.id,
        state: "learning",
        userId: user.id,
      }),
      ...Array.from({ length: 12 }, () =>
        itemFixture({ content: choiceItemContent(), skillId: library.skills[0]!.id }),
      ),
    ]);

    vi.setSystemTime(NOW);

    await prisma.$transaction(async (tx) => {
      await markLearnerChanged(tx, { planInputs: true, userId: user.id });

      await tx.planItem.deleteMany({
        where: { kind: "review", planId: fixture.plan.id, scheduledFor: TODAY },
      });

      await tx.planItem.updateMany({
        data: { completedAt: NOW, status: "done" },
        where: { kind: "lesson", planId: fixture.plan.id, scheduledFor: { lt: TODAY } },
      });
    });

    mockSession(user.id);
    const goal = await prisma.goal.findUniqueOrThrow({ where: { id: fixture.goal.id } });
    const selection = await selectDayPlan({ goal, now: NOW, timeZone: "UTC" });

    if (!selection) {
      throw new Error("Expected the actual overdue selection");
    }

    const review = selection.items.find(
      (item) => item.kind === "review" && item.scheduledFor?.getTime() === TODAY.getTime(),
    );

    expect(review).toMatchObject({ id: null, status: "todo" });

    const planned = await planStudyDay({
      goal,
      localDate: TODAY,
      now: NOW,
      selection,
      timeZone: "UTC",
      userId: user.id,
    });

    expect(planned.blocks.filter((block) => block.kind === "learn")).toHaveLength(0);
    const practice = planned.blocks.find((block) => block.kind === "practice");
    expect(practice).toBeDefined();
    expect.soft(practice?.payload.planItemKey).toBe(review && getItemKey(review));

    const opened = await openStudyDay({
      goalId: goal.id,
      shownDate: "2026-09-30",
      timeZone: "UTC",
    });

    expect(opened.status).toBe("opened");

    if (opened.status !== "opened") {
      throw new Error("Expected the planned review's Open");
    }

    const savedReview = await prisma.planItem.findFirstOrThrow({
      where: { kind: "review", planId: fixture.plan.id, scheduledFor: TODAY },
    });

    const savedBlock = await prisma.studySessionBlock.findFirstOrThrow({
      where: { kind: "practice", sessionId: opened.sessionId },
    });

    const payload = readBlockPayload(savedBlock);

    expect(payload).toMatchObject({
      planItemId: savedReview.id,
      planItemKey: getItemKey(savedReview),
    });

    expect(payload.itemIds.length).toBeGreaterThan(0);
    const ref = { blockId: savedBlock.id, sessionId: opened.sessionId };

    await expect(startStudyBlock({ ...ref, input: { timeZone: "UTC" } })).resolves.toMatchObject({
      status: "ready",
    });

    const answers = await Promise.all(
      payload.itemIds.map((itemId) =>
        answerStudyQuestion({
          ...ref,
          input: { answer: { selectedIndex: 0 }, durationMs: 1000, itemId, timeZone: "UTC" },
        }),
      ),
    );

    expect(answers.every((answer) => answer.status === "ready")).toBe(true);

    await expect(finishStudyBlock({ ...ref, input: { timeZone: "UTC" } })).resolves.toMatchObject({
      status: "ready",
    });

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: savedReview.id } }),
    ).resolves.toMatchObject({ status: "done" });
  });
});

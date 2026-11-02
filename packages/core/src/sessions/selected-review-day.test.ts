import { prisma } from "@zoonk/db";
import { learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { markLearnerChanged } from "../learner/_utils/mark-learner-changed";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { getItemKey } from "../plans/planner/plan-items";
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

describe("a selected review that has no persisted ID yet", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(START);
  });

  afterEach(() => vi.useRealTimers());

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

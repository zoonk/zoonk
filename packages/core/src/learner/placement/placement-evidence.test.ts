import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { describe, expect, it } from "vitest";
import { changeGoalPlan } from "../../plans/change-goal-plan";
import { PLAN_SHOWN, examTestGoalFixture, startSitting } from "../_test-utils/exam-test-goal";
import { loadAnsweredTestItems, loadEvidence } from "./_utils/placement-evidence";
import { answerPlacementQuestion } from "./answer-placement-question";
import { finishGoalPlacement } from "./finish-goal-placement";
import { readFocusTestRecord } from "./focus-test-state";
import { getGoalPlacement } from "./get-goal-placement";

describe("diagnostic progress outside the recent model evidence window", () => {
  it("keeps old test coverage, pace and answered items after 1,000 ordinary answers", async () => {
    const { goal, items, skills, user } = await examTestGoalFixture({
      subjects: [{ items: 6, name: "Math", questions: 10 }],
    });

    const session = await studySessionFixture({ goalId: goal.id, userId: user.id });
    const at = new Date();

    await Promise.all(
      items
        .slice(0, 5)
        .map((item, index) =>
          attemptFixture({
            answeredAt: new Date(at.getTime() + index),
            durationMs: index === 4 ? 900_000 : 120_000,
            isPlacement: true,
            itemId: item.id,
            skillId: item.skillId,
            userId: user.id,
          }),
        ),
    );

    await finishGoalPlacement({ goalId: goal.id, input: {} });

    const saved = readFocusTestRecord(
      await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
    );

    expect(saved?.summary).toMatchObject({ asked: 1, paceMs: 132_000 });

    await prisma.attempt.createMany({
      data: Array.from({ length: 1000 }, (_, index) => ({
        answer: { selectedIndex: 0 },
        answeredAt: new Date(at.getTime() + index + 10),
        durationMs: 1000,
        hour: 12,
        isCorrect: true,
        localDate: at,
        skillId: skills[0]!.id,
        studySessionId: session.id,
        userId: user.id,
        weekday: 1,
      })),
    });

    const read = await loadEvidence({ skillIds: skills.map((skill) => skill.id), userId: user.id });
    expect(read.evidence).toHaveLength(1000);

    expect(read.testSkills).toMatchObject([
      { answered: 5, paceAnswers: 5, paceDurationMs: 660_000 },
    ]);

    const answered = await loadAnsweredTestItems({
      itemIds: items.map((item) => item.id),
      userId: user.id,
    });

    expect(items.slice(0, 5).every((item) => answered.has(item.id))).toBe(true);
    expect(answered.has(items[5]!.id)).toBe(false);

    await finishGoalPlacement({ goalId: goal.id, input: {} });

    const continued = await startSitting(goal.id);
    expect(continued.next?.itemId).toBe(items[5]!.id);

    const after = readFocusTestRecord(
      await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
    );

    expect(after?.summary).toMatchObject({ asked: 1, paceMs: 132_000, unasked: 0 });
  });
});

describe("a finished Focus test after later study", () => {
  it("keeps its own evidence when a subject is skipped and restored after 1,000 later answers", async () => {
    const { goal, skills, user } = await examTestGoalFixture({
      goal: { ...PLAN_SHOWN, timezone: "UTC" },
      subjects: [{ items: 3, name: "Math", questions: 10 }],
    });

    const started = await startSitting(goal.id);

    const first = await answerPlacementQuestion({
      goalId: goal.id,
      input: { answer: { selectedIndex: 0 }, durationMs: 10_000, itemId: started.next!.itemId },
    });

    if (first.status !== "ready" || !first.placement.next) {
      throw new Error("Expected a confirmation question");
    }

    await answerPlacementQuestion({
      goalId: goal.id,
      input: {
        answer: { selectedIndex: 0 },
        durationMs: 10_000,
        itemId: first.placement.next.itemId,
      },
    });

    await finishGoalPlacement({ goalId: goal.id, input: {} });
    const at = new Date(Date.now() + 60_000);
    const session = await studySessionFixture({ goalId: goal.id, userId: user.id });

    await prisma.attempt.createMany({
      data: Array.from({ length: 1000 }, (_, index) => ({
        answer: { selectedIndex: 0 },
        answeredAt: new Date(at.getTime() + index),
        durationMs: 1000,
        hour: 12,
        isCorrect: true,
        localDate: at,
        skillId: skills[0]!.id,
        studySessionId: session.id,
        userId: user.id,
        weekday: 1,
      })),
    });

    for (const kind of ["skipAreas", "restoreAreas"] as const) {
      // oxlint-disable-next-line no-await-in-loop -- Restore follows the persisted skip.
      await changeGoalPlan({
        goalId: goal.id,
        input: { operations: [{ areas: ["Math"], kind }] },
        trackAnalytics: false,
      });
    }

    const read = await getGoalPlacement({ goalId: goal.id });
    expect(read.status === "ready" && read.placement.complete).toBe(true);
    expect(read.status === "ready" && read.placement.knownSkillIds).toStrictEqual([skills[0]!.id]);

    expect(
      readFocusTestRecord(await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }))?.summary
        ?.complete,
    ).toBe(true);
  });
});

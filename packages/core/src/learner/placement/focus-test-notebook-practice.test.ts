import { randomUUID } from "node:crypto";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { describe, expect, it } from "vitest";
import { PLAN_SHOWN, examTestGoalFixture } from "../_test-utils/exam-test-goal";
import { loadAnsweredTestItems, loadEvidence } from "./_utils/placement-evidence";
import { getGoalPlacement } from "./get-goal-placement";

describe("notebook practice outside the Focus test", () => {
  it("is not shown a test result after practicing a mistake in the notebook", async () => {
    const { goal, items, user } = await examTestGoalFixture({
      goal: PLAN_SHOWN,
      subjects: [
        { items: 8, name: "Math", questions: 10 },
        { items: 8, name: "Physics", questions: 8 },
        { items: 8, name: "History", questions: 6 },
        { items: 8, name: "Biology", questions: 4 },
      ],
    });

    const item = items.at(-1);
    const session = await studySessionFixture({ goalId: goal.id, userId: user.id });

    await attemptFixture({
      answer: { selectedIndex: 1 },
      isCorrect: false,
      itemId: item?.id ?? null,
      skillId: item?.skillId ?? null,
      studySessionId: session.id,
      userId: user.id,
    });

    const before = await getGoalPlacement({ goalId: goal.id });

    await attemptFixture({
      answer: { practiceMistakeId: randomUUID(), selectedIndex: 0 },
      durationMs: 4000,
      isCorrect: true,
      itemId: item?.id ?? null,
      skillId: item?.skillId ?? null,
      userId: user.id,
    });

    const after = await getGoalPlacement({ goalId: goal.id });

    expect(before.status).toBe("ready");
    expect(after.status).toBe("ready");

    expect(after.status === "ready" && after.placement).toMatchObject({
      answered: 0,
      focusTest: {
        checkpoint: null,
        offer: { minutes: 15 },
        subjects: [
          { asked: 0, dontKnow: 0, right: 0 },
          { asked: 0, dontKnow: 0, right: 0 },
          { asked: 0, dontKnow: 0, right: 0 },
          { asked: 0, dontKnow: 0, right: 0 },
        ],
      },
    });

    const evidence = await loadEvidence({ skillIds: [item!.skillId!], userId: user.id });
    expect(evidence.evidence).toHaveLength(2);
    expect(evidence.placementAnswers).toHaveLength(0);
    expect(evidence.testSkills).toHaveLength(0);

    await expect(
      loadAnsweredTestItems({ itemIds: [item!.id], userId: user.id }),
    ).resolves.toStrictEqual(new Set());
  });
});

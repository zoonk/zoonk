import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { describe, expect, it } from "vitest";
import { PLAN_SHOWN, examTestGoalFixture, startSitting } from "../_test-utils/exam-test-goal";
import { loadEvidence } from "./_utils/placement-evidence";
import { answerPlacementQuestion } from "./answer-placement-question";
import { finishGoalPlacement } from "./finish-goal-placement";
import { readFocusTestRecord } from "./focus-test-state";
import { getGoalPlacement } from "./get-goal-placement";

describe("test progress while a sitting stays open", () => {
  it("keeps legacy standalone Focus test answers as coverage and starting-point evidence", async () => {
    const { goal, items, user } = await examTestGoalFixture({
      subjects: [
        { items: 8, name: "Math", questions: 10 },
        { items: 8, name: "Physics", questions: 8 },
        { items: 8, name: "History", questions: 6 },
        { items: 8, name: "Biology", questions: 4 },
      ],
    });

    const oldAnswers = items.filter((_, index) => index % 3 === 0);

    await Promise.all(
      oldAnswers.map((item, index) =>
        attemptFixture({
          answer: { selectedIndex: 0 },
          durationMs: 30_000,
          isCorrect: index % 4 !== 0,
          itemId: item.id,
          skillId: item.skillId,
          userId: user.id,
        }),
      ),
    );

    const read = await getGoalPlacement({ goalId: goal.id });
    const placement = read.status === "ready" ? read.placement : null;

    expect(placement?.answered).toBe(oldAnswers.length);
    expect(placement?.knownSkillIds).toHaveLength(1);

    expect(
      placement?.focusTest?.subjects.map(({ asked, right }) => ({ asked, right })),
    ).toStrictEqual([
      { asked: 3, right: 2 },
      { asked: 3, right: 2 },
      { asked: 2, right: 2 },
      { asked: 3, right: 2 },
    ]);

    expect(placement?.focusTest?.offer).toMatchObject({
      kind: "continuation",
      minutes: 5,
      questions: 10,
    });
  });

  it.each(["mock", "chapter test-out"])(
    "keeps sitting counts separate from coverage after a %s",
    async (source) => {
      const { goal, items, user } = await examTestGoalFixture({
        goal: PLAN_SHOWN,
        subjects: [
          { items: 8, name: "Math", questions: 10 },
          { items: 8, name: "Physics", questions: 8 },
          { items: 8, name: "History", questions: 6 },
          { items: 8, name: "Biology", questions: 4 },
        ],
      });

      const started = await startSitting(goal.id);

      const first = await answerPlacementQuestion({
        goalId: goal.id,
        input: {
          answer: { selectedIndex: 0 },
          durationMs: 20_000,
          itemId: started.next?.itemId ?? "",
        },
      });

      const asked = first.status === "ready" ? first.placement.next?.itemId : null;

      const mock =
        source === "mock"
          ? await prisma.mockExam.create({
              data: {
                conditions: { purpose: "practice" },
                goalId: goal.id,
                sectionStartedAt: new Date(),
                userId: user.id,
              },
            })
          : null;

      const otherItems = items
        .filter((item) => item.id !== started.next?.itemId && item.id !== asked)
        .slice(0, 14);

      await Promise.all(
        otherItems.map((item) =>
          attemptFixture({
            answer: { selectedIndex: 0 },
            durationMs: 180_000,
            isCorrect: true,
            itemId: item.id,
            mockExamId: mock?.id ?? null,
            skillId: item.skillId,
            userId: user.id,
          }),
        ),
      );

      const resumed = await getGoalPlacement({ goalId: goal.id });
      const placement = resumed.status === "ready" ? resumed.placement : null;

      expect(placement?.focusTest?.sitting).toMatchObject({ answered: 1, end: null, left: 14 });
      expect(placement?.next).not.toBeNull();

      expect(placement?.focusTest?.subjects.reduce((sum, subject) => sum + subject.asked, 0)).toBe(
        source === "mock" ? 1 : 15,
      );

      const evidence = await loadEvidence({
        skillIds: items.flatMap((item) => item.skillId ?? []),
        userId: user.id,
      });

      expect(evidence.evidence).toHaveLength(15);

      expect(evidence.testSkills.reduce((sum, skill) => sum + skill.paceAnswers, 0)).toBe(
        source === "mock" ? 1 : 15,
      );

      await finishGoalPlacement({ goalId: goal.id, input: {} });

      await expect(
        prisma.learningEvent.findMany({
          select: { correctAnswers: true, seconds: true },
          where: { lessonKind: "focusTest", userId: user.id },
        }),
      ).resolves.toStrictEqual([{ correctAnswers: 1, seconds: 20 }]);

      const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });

      expect(readFocusTestRecord(saved)?.summary).toMatchObject({
        paceMs: source === "mock" ? 60_000 : (20_000 + 14 * 180_000) / 15,
      });
    },
  );
});

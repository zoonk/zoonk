import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { describe, expect, it } from "vitest";
import { examTestGoalFixture, startSitting } from "../_test-utils/exam-test-goal";
import { loadEvidence } from "./_utils/placement-evidence";
import { answerPlacementQuestion } from "./answer-placement-question";
import { finishGoalPlacement } from "./finish-goal-placement";
import { readFocusTestRecord } from "./focus-test-state";
import { getGoalPlacement } from "./get-goal-placement";

describe("test progress while a sitting stays open", () => {
  it.each(["mock", "chapter test-out"])(
    "counts only the test's own answers after a %s",
    async (source) => {
      const { goal, items, user } = await examTestGoalFixture({
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

      const mock = await prisma.mockExam.create({
        data: {
          conditions: { purpose: "practice" },
          goalId: goal.id,
          sectionStartedAt: new Date(),
          userId: user.id,
        },
      });

      const mockItems = items
        .filter((item) => item.id !== started.next?.itemId && item.id !== asked)
        .slice(0, 14);

      await Promise.all(
        mockItems.map((item) =>
          attemptFixture({
            answer: { selectedIndex: 0 },
            durationMs: 180_000,
            isCorrect: true,
            itemId: item.id,
            mockExamId: source === "mock" ? mock.id : null,
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
        1,
      );

      const evidence = await loadEvidence({
        skillIds: items.flatMap((item) => item.skillId ?? []),
        userId: user.id,
      });

      expect(evidence.evidence).toHaveLength(15);
      expect(evidence.testSkills.reduce((sum, skill) => sum + skill.paceAnswers, 0)).toBe(1);

      await finishGoalPlacement({ goalId: goal.id, input: {} });
      const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
      expect(readFocusTestRecord(saved)?.summary).toMatchObject({ paceMs: 60_000 });
    },
  );
});

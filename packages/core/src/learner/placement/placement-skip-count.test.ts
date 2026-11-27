import { prisma } from "@zoonk/db";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { lessonSkillFixture } from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { runDeferredWork } from "../../_test-utils/deferred-work";
import { mockSession } from "../../_test-utils/mock-session";
import { analytics } from "../../_test-utils/test-boundaries";
import { loadCourseOutline } from "../../goals/_utils/course-outline";
import { toCoursePlanGraph } from "../../goals/_utils/course-plan-graph";
import { recordPlacementPrepared } from "../../lookahead/placement-item-skills";
import { createGoalPlan } from "../../plans/create-goal-plan";
import { decidePlanChange } from "../../plans/decide-plan-change";
import { getGoalPlan } from "../../plans/get-goal-plan";
import { parsePlanGraph } from "../../plans/planner/plan-state";
import { refreshTestedOutPlan } from "../../plans/refresh-tested-out-plan";
import { learnerGoalFixture } from "../_test-utils/learner-goal";
import { placementItemBank } from "../_test-utils/placement-tap-items";
import { answerPlacementQuestion } from "./answer-placement-question";
import { finishGoalPlacement } from "./finish-goal-placement";
import { startPlacementSitting } from "./start-placement-sitting";

type Placement = Extract<Awaited<ReturnType<typeof startPlacementSitting>>, { status: "ready" }>;

async function confirmTopics({
  bank,
  goalId,
  opened,
}: {
  bank: Awaited<ReturnType<typeof placementItemBank>>[number];
  goalId: string;
  opened: Placement;
}) {
  const { attempt } = opened.placement;

  if (!attempt) {
    throw new Error("Expected an open whole-course part");
  }

  const send = async (current: Placement, remaining: number): Promise<void> => {
    if (remaining === 0) {
      return;
    }

    const question = bank.find(({ item }) => item.id === current.placement.next?.itemId);

    if (!question) {
      throw new Error("Expected the next seeded question");
    }

    const answered = await answerPlacementQuestion({
      goalId,
      input: {
        answer: question.answer,
        attemptId: attempt.id,
        durationMs: 1000,
        itemId: question.item.id,
        part: attempt.part,
      },
    });

    if (answered.status !== "ready") {
      throw new Error(`The answer wasn't saved: ${answered.status}`);
    }

    await send(answered, remaining - 1);
  };

  await send(opened, bank.length);
}

describe("course placement counts", () => {
  it.each([
    { boundary: "stop and resume", firstTopics: 1, secondPart: 1 },
    { boundary: "next part", firstTopics: 3, secondPart: 2 },
  ])(
    "skips a lesson spanning topics confirmed across $boundary",
    async ({ firstTopics, secondPart }) => {
      const user = await userFixture();

      const { goal, planItems, skills } = await learnerGoalFixture({
        itemsPerSkill: 0,
        phases: [firstTopics + 1],
        userId: user.id,
      });

      const shared = planItems[firstTopics]!;

      const [banks] = await Promise.all([
        placementItemBank(skills.map(({ id }) => id)),
        lessonSkillFixture({ lessonId: shared.lessonId!, skillId: skills[0]!.id }),
        prisma.planItem.update({ data: { skillId: null }, where: { id: shared.id } }),
      ]);

      mockSession(user.id);

      const finish = async (topicBanks: typeof banks, part: number) => {
        const opened = await startPlacementSitting({
          goalId: goal.id,
          input: { length: "wholeCourse" },
        });

        if (opened.status !== "ready" || !opened.placement.attempt) {
          throw new Error("Expected a saved placement attempt");
        }

        expect(opened.placement.attempt.part).toBe(part);
        await confirmTopics({ bank: topicBanks.flat(), goalId: goal.id, opened });

        return finishGoalPlacement({
          goalId: goal.id,
          input: { attemptId: opened.placement.attempt.id, part },
        });
      };

      const readShared = () => prisma.planItem.findUniqueOrThrow({ where: { id: shared.id } });
      const flush = runDeferredWork();

      await expect(finish(banks.slice(0, firstTopics), 1)).resolves.toMatchObject({
        completion: { lessonsSkipped: firstTopics },
      });

      await expect(readShared()).resolves.toMatchObject({ status: "todo" });

      const finished = await finish(banks.slice(firstTopics), secondPart);

      await expect(readShared()).resolves.toMatchObject({ status: "testedOut" });

      expect(finished).toMatchObject({
        completion: {
          finish: { lessonsSkipped: 1 },
          knownSkillIds: [skills[firstTopics]!.id],
          lessonsSkipped: 1,
          partLessonsSkipped: 1,
          result: { lessonsSkipped: firstTopics + 1, partLessonsSkipped: 1 },
          testedOutPlanItemIds: [shared.id],
        },
      });

      await flush();

      expect(analytics.trackServerEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Test Finished",
          properties: expect.objectContaining({
            answered: secondPart === 1 ? 8 : 4,
            goal_id: goal.id,
            lessons_skipped: 1,
            part: secondPart,
          }),
        }),
      );

      if (finished.status !== "ready" || !finished.completion.changeId) {
        throw new Error("Expected Undo for the shared lesson");
      }

      await expect(
        decidePlanChange({
          changeId: finished.completion.changeId,
          goalId: goal.id,
          input: { status: "undone" },
        }),
      ).resolves.toMatchObject({ change: { status: "undone" }, status: "updated" });

      await expect(readShared()).resolves.toMatchObject({ status: "todo" });

      await expect(
        prisma.planItem.count({
          where: {
            id: { in: planItems.slice(0, firstTopics).map(({ id }) => id) },
            status: "testedOut",
          },
        }),
      ).resolves.toBe(firstTopics);
    },
  );

  it.each([
    { lessonsPerTopic: 511, source: "estimated topics" },
    { lessonsPerTopic: 1, source: "existing course outline" },
  ])(
    "counts the saved work for $source once across a stop and restores it through Undo",
    async ({ lessonsPerTopic, source }) => {
      const { course, goal, plan, skills, user } = await languageGoalFixture();
      const [first, second] = skills;

      if (!first || !second) {
        throw new Error("Expected two topics to confirm");
      }

      const [banks, outline] = await Promise.all([
        placementItemBank([first.id, second.id]),
        loadCourseOutline({ courseId: course.id, userId: user.id }),
        prisma.goal.update({
          data: { details: { level: "A2", targetScore: "B1+" }, planRevealedAt: new Date() },
          where: { id: goal.id },
        }),
      ]);

      await createGoalPlan({
        goalId: goal.id,
        graph:
          source === "existing course outline"
            ? toCoursePlanGraph({ chapters: outline, course, startChapterId: null })
            : parsePlanGraph(plan.graph),
      });

      await prisma.planItem.updateMany({
        data: { completedAt: new Date(), status: "done" },
        where: {
          kind: "lesson",
          planId: plan.id,
          skillId: { in: skills.slice(2).map((skill) => skill.id) },
        },
      });

      const readWork = () =>
        prisma.planItem.findMany({
          orderBy: { id: "asc" },
          select: { id: true, lessons: true, skillId: true, status: true },
          where: { kind: "lesson", planId: plan.id, skillId: { in: [first.id, second.id] } },
        });

      await prisma.goal.update({ data: { kind: "learn" }, where: { id: goal.id } });
      const before = await readWork();
      const firstWork = before.filter(({ skillId }) => skillId === first.id);
      const secondWork = before.filter(({ skillId }) => skillId === second.id);
      const firstCount = firstWork.reduce((total, item) => total + (item.lessons ?? 1), 0);
      const secondCount = secondWork.reduce((total, item) => total + (item.lessons ?? 1), 0);

      expect(before).toHaveLength(source === "estimated topics" ? 4 : 2);
      expect(secondCount).toBe(lessonsPerTopic);

      mockSession(user.id);

      const startPart = async () => {
        const opened = await startPlacementSitting({
          goalId: goal.id,
          input: { length: "wholeCourse" },
        });

        if (opened.status !== "ready" || !opened.placement.attempt) {
          throw new Error("Expected a whole-course attempt");
        }

        const { id: attemptId, part } = opened.placement.attempt;

        await recordPlacementPrepared({
          goalId: goal.id,
          placementPart: { attemptId, part },
          planRunId: null,
        });

        return { input: { attemptId, part }, opened };
      };

      const partOne = await startPart();
      await confirmTopics({ bank: banks[0]!, goalId: goal.id, opened: partOne.opened });

      await expect(
        finishGoalPlacement({ goalId: goal.id, input: partOne.input }),
      ).resolves.toMatchObject({
        completion: {
          attempt: { partComplete: false, resume: { part: 1, question: 5 } },
          partLessonsSkipped: firstCount,
        },
      });

      await refreshTestedOutPlan({ goalId: goal.id, userId: user.id });

      await expect(readWork()).resolves.toStrictEqual(
        before.map((item) => ({
          ...item,
          status: item.skillId === first.id ? "testedOut" : "todo",
        })),
      );

      const shown = await getGoalPlan(goal.id);

      if (shown.status !== "ready") {
        throw new Error("Expected the plan after part one");
      }

      const { currentPhase, phases, status } = shown.plan;
      const partTwo = await startPart();
      await confirmTopics({ bank: banks[1]!, goalId: goal.id, opened: partTwo.opened });
      const finished = await finishGoalPlacement({ goalId: goal.id, input: partTwo.input });

      expect(finished).toMatchObject({
        completion: {
          attempt: null,
          lessonsSkipped: secondCount,
          partLessonsSkipped: secondCount,
          result: { lessonsSkipped: firstCount + secondCount },
          testedOutPlanItemIds: expect.arrayContaining(secondWork.map(({ id }) => id)),
        },
      });

      if (finished.status !== "ready" || !finished.completion.changeId) {
        throw new Error("Expected an Undo for part two");
      }

      await refreshTestedOutPlan({ goalId: goal.id, userId: user.id });

      await expect(readWork()).resolves.toStrictEqual(
        before.map((item) => ({ ...item, status: "testedOut" })),
      );

      await expect(
        decidePlanChange({
          changeId: finished.completion.changeId,
          goalId: goal.id,
          input: { status: "undone" },
        }),
      ).resolves.toMatchObject({ status: "updated" });

      await expect(readWork()).resolves.toStrictEqual(
        before.map((item) => ({
          ...item,
          status: item.skillId === first.id ? "testedOut" : "todo",
        })),
      );

      await expect(getGoalPlan(goal.id)).resolves.toMatchObject({
        plan: { currentPhase, phases, status },
        status: "ready",
      });
    },
  );
});

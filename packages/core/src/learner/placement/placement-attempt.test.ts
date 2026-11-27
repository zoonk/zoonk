import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { itemFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { loadTodayPlanChange } from "../../plans/_utils/today-plan-change";
import { decidePlanChange } from "../../plans/decide-plan-change";
import { getGoalPlan } from "../../plans/get-goal-plan";
import { refreshTestedOutPlan } from "../../plans/refresh-tested-out-plan";
import { gradeOrder, parseOrderItem } from "../../sessions/_utils/order-items";
import { learnerGoalFixture } from "../_test-utils/learner-goal";
import { placementItemBank } from "../_test-utils/placement-tap-items";
import { getPlacementBlockId } from "./_utils/placement-items";
import { answerPlacementQuestion } from "./answer-placement-question";
import { finishGoalPlacement } from "./finish-goal-placement";
import { getGoalPlacement } from "./get-goal-placement";
import { startPlacementSitting } from "./start-placement-sitting";

describe("learn placement attempts", () => {
  it("uses the same fixed parts for a quick test, a manual stop and the whole course", async () => {
    const user = await userFixture();

    const { goal, skills, planItems } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [4],
      userId: user.id,
    });

    const bank = await placementItemBank(skills.map(({ id }) => id));
    const answers = new Map(bank.flat().map(({ answer, item }) => [item.id, answer]));
    mockSession(user.id);

    await expect(getGoalPlan(goal.id)).resolves.toMatchObject({
      plan: {
        placementTest: {
          offer: {
            estimatedMinutes: 6,
            questions: 12,
            wholeCourse: { estimatedMinutes: 9, parts: 2 },
          },
        },
      },
    });

    const start = (length: "quick" | "wholeCourse" = "quick") =>
      startPlacementSitting({ goalId: goal.id, input: { length } });

    const opened = await start();

    if (opened.status !== "ready" || !opened.placement.attempt) {
      throw new Error("Expected a saved attempt");
    }

    const { id: attemptId } = opened.placement.attempt;

    expect(opened.placement.attempt).toMatchObject({
      answered: 0,
      chapter: "Chapter 1",
      part: 1,
      parts: 2,
      partsLeft: 2,
      questions: 12,
      totalEstimatedMinutes: 9,
    });

    const send = async (
      state: typeof opened.placement,
      count: number,
    ): Promise<typeof opened.placement> => {
      if (count === 0) {
        return state;
      }

      const itemId = state.next?.itemId;
      const answer = itemId && answers.get(itemId);

      if (!itemId || !answer) {
        throw new Error("Expected a question with a seeded answer");
      }

      const response = await answerPlacementQuestion({
        goalId: goal.id,
        input: { answer, attemptId, durationMs: 90_000, itemId },
      });

      if (response.status !== "ready") {
        throw new Error("Expected the saved answer");
      }

      return send(response.placement, count - 1);
    };

    const afterFive = await send(opened.placement, 5);
    expect(afterFive).toMatchObject({ attempt: { answered: 5, questions: 12 }, status: "asking" });

    const stop = () => finishGoalPlacement({ goalId: goal.id, input: { answered: 5, attemptId } });
    const stopped = await stop();

    expect(stopped).toMatchObject({
      completion: {
        attempt: { partComplete: false, questions: 12, resume: { part: 1, question: 6 } },
        finish: { answered: 5, end: "stopped", lessonsSkipped: 1, partsLeft: 2, unknowns: 0 },
        result: { lessonsSkipped: 1, nextLesson: { id: planItems[1]!.lessonId } },
      },
    });

    await expect(stop()).resolves.toStrictEqual(stopped);

    const resumed = await start();

    if (resumed.status !== "ready") {
      throw new Error("Expected to resume placement");
    }

    expect(resumed.placement).toMatchObject({
      attempt: { answered: 5, id: attemptId, part: 1, questions: 12, resume: null },
      next: { itemId: afterFive.next?.itemId },
    });

    const capped = await send(resumed.placement, 7);

    expect(capped).toMatchObject({
      attempt: { answered: 12, questions: 12 },
      next: null,
      status: "done",
    });

    await expect(
      finishGoalPlacement({ goalId: goal.id, input: { answered: 12, attemptId } }),
    ).resolves.toMatchObject({
      completion: {
        attempt: { id: attemptId, nextPart: 2, partComplete: true, partsLeft: 1 },
        finish: { end: "question_cap", lessonsSkipped: 2 },
        result: { lessonsSkipped: 3 },
      },
    });

    await expect(start("wholeCourse")).resolves.toMatchObject({
      placement: {
        attempt: {
          answered: 0,
          id: attemptId,
          length: "wholeCourse",
          part: 2,
          parts: 2,
          questions: 4,
        },
        next: { skillId: skills[3]!.id },
      },
    });
  });

  it("passes a pruned part without renumbering the next one", async () => {
    const user = await userFixture();

    const { goal, items, skills } = await learnerGoalFixture({
      itemsPerSkill: 1,
      phases: [8],
      userId: user.id,
    });

    const independent = skills[7]!;
    await prisma.skillPrerequisite.deleteMany({ where: { skillId: independent.id } });
    mockSession(user.id);

    const start = () =>
      startPlacementSitting({ goalId: goal.id, input: { length: "wholeCourse" } });

    const opened = await start();

    if (opened.status !== "ready" || !opened.placement.attempt) {
      throw new Error("Expected the first part");
    }

    const { id: attemptId } = opened.placement.attempt;

    const answered = await answerPlacementQuestion({
      goalId: goal.id,
      input: { answer: { dontKnow: true }, attemptId, durationMs: 1000, itemId: items[0]!.id },
    });

    expect(answered).toMatchObject({ placement: { next: null, status: "done" } });

    await expect(
      finishGoalPlacement({ goalId: goal.id, input: { attemptId } }),
    ).resolves.toMatchObject({
      completion: {
        attempt: { nextPart: 3, part: 1, partComplete: true, parts: 3, partsLeft: 1 },
        finish: { answered: 1, end: "material_exhausted", lessonsSkipped: 0, unknowns: 1 },
      },
    });

    await expect(start()).resolves.toMatchObject({
      placement: {
        attempt: { id: attemptId, part: 3, parts: 3, questions: 4 },
        next: { skillId: independent.id },
      },
    });
  });

  it("finishes an old open part at twelve even when its stored scope was larger", async () => {
    const user = await userFixture();

    const { goal, skills } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [4],
      userId: user.id,
    });

    const skillIds = skills.map((skill) => skill.id);
    const bank = await placementItemBank(skillIds);
    const id = randomUUID();
    const answeredAt = new Date();

    await prisma.goal.update({
      data: {
        details: {
          placementTest: {
            attempt: {
              estimatedMinutes: 10,
              id,
              length: "wholeCourse",
              lessonsSkipped: 0,
              part: 1,
              partComplete: false,
              partPrepared: true,
              partSkillIds: skillIds,
              partStartedAt: answeredAt.toISOString(),
              skillIds,
            },
            result: null,
          },
        },
      },
      where: { id: goal.id },
    });

    await Promise.all(
      bank
        .slice(0, 3)
        .flat()
        .map(({ item }) =>
          attemptFixture({
            answer: { placementPending: true },
            answeredAt,
            focusTestId: id,
            isPlacement: true,
            itemId: item.id,
            skillId: item.skillId,
            userId: user.id,
          }),
        ),
    );

    mockSession(user.id);

    await expect(getGoalPlacement({ goalId: goal.id })).resolves.toMatchObject({
      placement: { attempt: { answered: 12, id, questions: 12 }, next: null, status: "done" },
    });

    await expect(
      finishGoalPlacement({ goalId: goal.id, input: { attemptId: id } }),
    ).resolves.toMatchObject({ completion: { finish: { answered: 12, end: "question_cap" } } });
  });

  it("rejects a finish for an older attempt after a retake starts", async () => {
    const user = await userFixture();
    const { goal } = await learnerGoalFixture({ itemsPerSkill: 2, phases: [1], userId: user.id });
    mockSession(user.id);

    const start = () => startPlacementSitting({ goalId: goal.id, input: {} });
    const opened = await start();

    if (opened.status !== "ready" || !opened.placement.attempt || !opened.placement.next) {
      throw new Error("Expected an open attempt with a question");
    }

    const { id: attemptId } = opened.placement.attempt;

    await answerPlacementQuestion({
      goalId: goal.id,
      input: {
        answer: { dontKnow: true },
        attemptId,
        durationMs: 1000,
        itemId: opened.placement.next.itemId,
      },
    });

    const finish = () => finishGoalPlacement({ goalId: goal.id, input: { attemptId } });

    await expect(finish()).resolves.toMatchObject({
      completion: { attempt: null },
      status: "ready",
    });

    await expect(start()).resolves.toMatchObject({
      placement: { attempt: { id: expect.not.stringMatching(attemptId) } },
    });

    await expect(finish()).resolves.toStrictEqual({ status: "staleAttempt" });
  });

  it("records the skip and keeps the shown session and Undo after finish", async () => {
    const user = await userFixture();

    const { goal, items, planItems, skills } = await learnerGoalFixture({
      challengesDone: true,
      itemsPerSkill: 1,
      phases: [1],
      userId: user.id,
    });

    const item = planItems[0]!;
    const skillId = skills[0]!.id;

    const session = await studySessionFixture({
      goalId: goal.id,
      status: "active",
      userId: user.id,
    });

    const saveTap = (suffix: string) =>
      itemFixture({
        content: {
          question: "Order the steps",
          reason: "Sequence",
          steps: ["A", "B", "C", suffix],
        },
        format: "order",
        skillId,
      });

    const [active, pending, ...taps] = await Promise.all([
      studySessionBlockFixture({
        lessonId: item.lessonId,
        position: 0,
        sessionId: session.id,
        status: "active",
      }),
      studySessionBlockFixture({
        lessonId: item.lessonId,
        position: 1,
        sessionId: session.id,
        status: "pending",
      }),
      saveTap("D"),
      saveTap("E"),
      saveTap("F"),
    ]);

    mockSession(user.id);

    const started = await startPlacementSitting({ goalId: goal.id, input: { length: "quick" } });

    if (started.status !== "ready" || !started.placement.attempt) {
      throw new Error("Expected a saved attempt");
    }

    const attemptId = started.placement.attempt.id;

    const tapAnswers = new Map(
      taps.map((tap) => {
        const parsed = parseOrderItem(tap);

        if (!parsed) {
          throw new Error("Expected a saved ordering item");
        }

        return [
          tap.id,
          gradeOrder({
            answer: { dontKnow: true },
            blockId: getPlacementBlockId(parsed),
            item: parsed,
          }).correctAnswer,
        ] as const;
      }),
    );

    const sent = await answerPlacementQuestion({
      goalId: goal.id,
      input: { answer: { selectedIndex: 0 }, attemptId, durationMs: 100, itemId: items[0]!.id },
    });

    const answerTaps = async (result: typeof sent, remaining: number): Promise<typeof sent> => {
      if (remaining === 0) {
        return result;
      }

      if (result.status !== "ready" || !result.placement.next) {
        throw new Error("Expected another tap");
      }

      const itemId = result.placement.next.itemId;
      const answer = tapAnswers.get(itemId);

      if (!answer) {
        throw new Error("Expected a tap from the saved bank");
      }

      return answerTaps(
        await answerPlacementQuestion({
          goalId: goal.id,
          input: { answer, attemptId, durationMs: 100, itemId },
        }),
        remaining - 1,
      );
    };

    await answerTaps(sent, taps.length);

    await expect(prisma.planItem.findUnique({ where: { id: item.id } })).resolves.toMatchObject({
      status: "todo",
    });

    const finish = () => finishGoalPlacement({ goalId: goal.id, input: { attemptId } });
    const [finished, retried] = await Promise.all([finish(), finish()]);

    expect(finished).toMatchObject({
      completion: {
        changeId: expect.any(String),
        lessonsSkipped: 1,
        result: { lessonsSkipped: 1 },
        testedOutPlanItemIds: [item.id],
      },
      status: "ready",
    });

    if (finished.status !== "ready" || !finished.completion.changeId) {
      throw new Error("Expected the finish's Undo ID");
    }

    const { changeId } = finished.completion;
    expect(retried).toMatchObject({ completion: { changeId, lessonsSkipped: 1 } });

    await refreshTestedOutPlan({ goalId: goal.id, userId: user.id });

    await expect(
      prisma.planChange.count({ where: { kind: "testedOut", planId: item.planId } }),
    ).resolves.toBe(1);

    await expect(finish()).resolves.toMatchObject({ completion: { changeId } });

    await expect(loadTodayPlanChange({ goal, now: new Date() })).resolves.toMatchObject({
      canUndo: true,
      id: changeId,
    });

    await expect(getGoalPlan(goal.id)).resolves.toMatchObject({
      plan: {
        changes: expect.arrayContaining([expect.objectContaining({ canUndo: true, id: changeId })]),
      },
      status: "ready",
    });

    await expect(
      decidePlanChange({ changeId, goalId: goal.id, input: { status: "undone" } }),
    ).resolves.toMatchObject({ status: "updated" });

    await expect(prisma.planItem.findUnique({ where: { id: item.id } })).resolves.toMatchObject({
      status: "todo",
    });

    await expect(getGoalPlan(goal.id)).resolves.toMatchObject({
      plan: { placementTest: { result: { lessonsSkipped: 0 } } },
      status: "ready",
    });

    await expect(
      prisma.studySessionBlock.findMany({
        orderBy: { position: "asc" },
        where: { sessionId: session.id },
      }),
    ).resolves.toStrictEqual([active, pending]);
  });
});

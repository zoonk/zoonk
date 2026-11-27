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
import { runDeferredWork } from "../../_test-utils/deferred-work";
import { mockSession } from "../../_test-utils/mock-session";
import { pickInPlacement } from "../../_test-utils/shown-choice";
import { analytics } from "../../_test-utils/test-boundaries";
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
import { type PlacementAnswerInput } from "./placement-contract";
import { startPlacementSitting } from "./start-placement-sitting";

describe("learn placement attempts", () => {
  it("uses the same fixed parts for a quick test, a manual stop and the whole course", async () => {
    const user = await userFixture();

    const { goal, skills, planItems } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [12],
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
            wholeCourse: { estimatedMinutes: 26, parts: 4 },
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
      parts: 4,
      partsLeft: 4,
      partsRemoved: 0,
      questions: 12,
      remainingEstimatedMinutes: 26,
      totalEstimatedMinutes: 26,
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
        input: { answer, attemptId, durationMs: 90_000, itemId, part: state.attempt?.part },
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
        attempt: {
          partComplete: false,
          questions: 12,
          remainingEstimatedMinutes: 23,
          resume: { part: 1, question: 6 },
        },
        finish: { answered: 5, end: "stopped", lessonsSkipped: 1, partsLeft: 4, unknowns: 0 },
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
        attempt: {
          id: attemptId,
          nextPart: 2,
          partComplete: true,
          parts: 4,
          partsLeft: 3,
          partsRemoved: 0,
          remainingEstimatedMinutes: 19,
          totalEstimatedMinutes: 26,
        },
        finish: { end: "question_cap", lessonsSkipped: 2 },
        result: { lessonsSkipped: 3 },
      },
    });

    const continued = await start("wholeCourse");

    expect(continued).toMatchObject({
      placement: {
        attempt: {
          answered: 0,
          id: attemptId,
          length: "wholeCourse",
          part: 2,
          parts: 4,
          questions: 12,
        },
        next: { skillId: skills[3]!.id },
      },
    });

    if (continued.status !== "ready") {
      throw new Error("Expected to continue after the first part");
    }

    const finishKnownPart = async (
      state: typeof opened.placement,
      part: number,
    ): Promise<Awaited<ReturnType<typeof finishGoalPlacement>>> => {
      expect(state.attempt).toMatchObject({ part, parts: 4, partsLeft: 5 - part });
      const done = await send(state, 12);
      expect(done.attempt).toMatchObject({ answered: 12, part, parts: 4, partsLeft: 4 - part });

      const result = await finishGoalPlacement({
        goalId: goal.id,
        input: { answered: 12, attemptId, part },
      });

      expect(result).toMatchObject({ completion: { finish: { partsLeft: 4 - part } } });

      if (part === 4) {
        return result;
      }

      const next = await start("wholeCourse");

      if (next.status !== "ready") {
        throw new Error("Expected to continue to the next part");
      }

      return finishKnownPart(next.placement, part + 1);
    };

    await expect(finishKnownPart(continued.placement, 2)).resolves.toMatchObject({
      completion: {
        attempt: null,
        complete: true,
        result: { lessonsSkipped: 12, part: 4, partsRemoved: 0 },
      },
    });
  });

  it.each(["wholeCourse", "quick"] as const)(
    "continues a %s test past a pruned part when Android sends the saved length",
    async (length) => {
      const user = await userFixture();

      const { goal, items, skills } = await learnerGoalFixture({
        itemsPerSkill: 1,
        phases: [12],
        userId: user.id,
      });

      const independent = skills[9]!;
      await prisma.skillPrerequisite.deleteMany({ where: { skillId: independent.id } });
      mockSession(user.id);

      const goalId = goal.id;
      const timeZone = "UTC";
      const start = () => startPlacementSitting({ goalId, input: { length, timeZone } });

      await expect(getGoalPlacement({ goalId })).resolves.toMatchObject({
        placement: { attempt: null },
      });

      const opened = await start();

      if (opened.status !== "ready" || !opened.placement.attempt) {
        throw new Error("Expected the first part");
      }

      const { id: attemptId, part } = opened.placement.attempt;
      expect(opened.placement.attempt).toMatchObject({ part: 1, parts: 4 });

      const answered = await answerPlacementQuestion({
        goalId,
        input: {
          answer: { dontKnow: true },
          attemptId,
          durationMs: 1000,
          itemId: items[0]!.id,
          part,
          timeZone,
        },
      });

      expect(answered).toMatchObject({
        placement: {
          attempt: { part: 1, parts: 4, partsLeft: 1, partsRemoved: 0 },
          next: null,
          status: "done",
        },
      });

      const flush = runDeferredWork();

      const finish = () =>
        finishGoalPlacement({ goalId, input: { attemptId, fromScratch: false, part, timeZone } });

      const checkpoint = await finish();

      expect(checkpoint).toMatchObject({
        completion: {
          attempt: {
            nextPart: 2,
            part: 1,
            partComplete: true,
            parts: 2,
            partsLeft: 1,
            partsRemoved: 2,
            remainingEstimatedMinutes: 6,
            totalEstimatedMinutes: 13,
          },
          finish: { answered: 1, end: "material_exhausted", partsLeft: 1, unknowns: 1 },
        },
      });

      await expect(prisma.goal.findUnique({ where: { id: goalId } })).resolves.toMatchObject({
        details: {
          placementTest: {
            attempt: {
              parts: [skills.slice(0, 3), skills.slice(9)].map((topics) =>
                topics.map(({ id }) => id),
              ),
            },
          },
        },
      });

      await expect(finish()).resolves.toStrictEqual(checkpoint);
      await flush();

      expect(analytics.trackServerEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Test Finished",
          properties: expect.objectContaining({
            goal_id: goalId,
            part: 1,
            parts: 2,
            parts_left: 1,
          }),
        }),
      );

      await expect(getGoalPlan(goalId)).resolves.toMatchObject({
        plan: {
          placementTest: {
            attempt: {
              nextPart: 2,
              parts: 2,
              partsLeft: 1,
              partsRemoved: 2,
              remainingEstimatedMinutes: 6,
            },
            estimatedMinutes: 6,
            state: "continue",
          },
        },
      });

      const continuation = {
        placement: {
          attempt: {
            answered: 0,
            id: attemptId,
            length: "wholeCourse",
            part: 2,
            parts: 2,
            questions: 12,
          },
          next: { skillId: independent.id },
          status: "asking",
        },
      };

      await expect(start()).resolves.toMatchObject(continuation);
      await expect(start()).resolves.toMatchObject(continuation);

      const nextAnswer: PlacementAnswerInput = {
        answer: { dontKnow: true },
        attemptId,
        durationMs: 1000,
        itemId: items[9]!.id,
        timeZone,
      };

      await expect(
        answerPlacementQuestion({ goalId, input: { ...nextAnswer, part } }),
      ).resolves.toStrictEqual({ status: "invalidItem" });

      await expect(
        answerPlacementQuestion({ goalId, input: { ...nextAnswer, part: 2 } }),
      ).resolves.toMatchObject({
        placement: { attempt: { answered: 1, part: 2 }, status: "done" },
      });
    },
  );

  it.each([false, true])(
    "keeps the first part total through pruning (stopped midway: %s)",
    async (stopMidway) => {
      const user = await userFixture();

      const { goal, skills } = await learnerGoalFixture({
        itemsPerSkill: 0,
        phases: [12],
        userId: user.id,
      });

      const partitionStarts = [skills[1]!.id, skills[3]!.id, skills[6]!.id, skills[9]!.id];
      await prisma.skillPrerequisite.deleteMany({ where: { skillId: { in: partitionStarts } } });

      await prisma.skillPrerequisite.create({
        data: { prerequisiteId: skills[0]!.id, skillId: skills[9]!.id },
      });

      if (stopMidway) {
        await prisma.skillPrerequisite.create({
          data: { prerequisiteId: skills[1]!.id, skillId: skills[6]!.id },
        });
      }

      await placementItemBank(skills.map(({ id }) => id));
      mockSession(user.id);
      const goalId = goal.id;
      const start = () => startPlacementSitting({ goalId, input: { length: "wholeCourse" } });
      const opened = await start();

      if (opened.status !== "ready" || !opened.placement.attempt || !opened.placement.next) {
        throw new Error("Expected a saved attempt with a question");
      }

      const { id: attemptId, part } = opened.placement.attempt;
      const { itemId } = opened.placement.next;
      const answeredFirst = { answered: 1, id: attemptId, part: 1, parts: 4, partsRemoved: 0 };
      expect(opened.placement.attempt).toMatchObject({ answered: 0, part: 1, parts: 4 });

      const send = (input: Pick<PlacementAnswerInput, "answer" | "itemId">) =>
        answerPlacementQuestion({ goalId, input: { ...input, attemptId, durationMs: 1000, part } });

      const finish = (answered: number) =>
        finishGoalPlacement({ goalId, input: { answered, attemptId, part } });

      const first = await send({ answer: { dontKnow: true }, itemId });

      expect(first).toMatchObject({
        placement: { attempt: answeredFirst, next: { skillId: skills[1]!.id }, status: "asking" },
      });

      await expect(getGoalPlan(goalId)).resolves.toMatchObject({
        plan: { placementTest: { attempt: answeredFirst, state: "continue" } },
      });

      if (first.status !== "ready" || !first.placement.next) {
        throw new Error("Expected a second question");
      }

      const secondItemId = first.placement.next.itemId;

      const stopAndResume = async () => {
        await expect(finish(1)).resolves.toMatchObject({
          completion: {
            attempt: {
              ...answeredFirst,
              partComplete: false,
              partsLeft: 3,
              resume: { part: 1, question: 2 },
            },
          },
        });

        await expect(getGoalPlan(goalId)).resolves.toMatchObject({
          plan: {
            placementTest: {
              attempt: { ...answeredFirst, resume: { part: 1, question: 2 } },
              state: "continue",
            },
          },
        });

        await expect(start()).resolves.toMatchObject({
          placement: {
            attempt: { ...answeredFirst, resume: null },
            next: { itemId: secondItemId },
          },
        });
      };

      if (stopMidway) {
        await stopAndResume();
      }

      await send({ answer: { dontKnow: true }, itemId: secondItemId });

      const parts = stopMidway ? 2 : 3;
      const checkpoint = await finish(2);

      expect(checkpoint).toMatchObject({
        completion: {
          attempt: {
            nextPart: 2,
            part: 1,
            partComplete: true,
            parts,
            partsLeft: parts - 1,
            partsRemoved: 4 - parts,
            remainingEstimatedMinutes: stopMidway ? 6 : 13,
            totalEstimatedMinutes: stopMidway ? 13 : 19,
          },
          finish: { partsLeft: parts - 1 },
        },
      });

      await expect(finish(2)).resolves.toStrictEqual(checkpoint);

      await expect(start()).resolves.toMatchObject({
        placement: {
          attempt: { answered: 0, id: attemptId, part: 2, parts, partsRemoved: 0, questions: 12 },
          next: { skillId: skills[3]!.id },
        },
      });
    },
  );

  it("does not replay a course attempt's answer to released Android's attempt-less Quick test", async () => {
    const user = await userFixture();

    const { goal, skills } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [1],
      userId: user.id,
    });

    const bank = await placementItemBank(skills.map(({ id }) => id));
    const answers = new Map(bank.flat().map(({ answer, item }) => [item.id, answer]));
    const goalId = goal.id;
    const timeZone = "UTC";
    mockSession(user.id);

    const read = await getGoalPlacement({ goalId });

    if (read.status !== "ready" || read.placement.attempt || !read.placement.next) {
      throw new Error("Expected a question from the attempt-less test");
    }

    const { itemId } = read.placement.next;
    const answer = answers.get(itemId);

    if (!answer) {
      throw new Error("Expected the seeded answer");
    }

    const opened = await startPlacementSitting({ goalId, input: { length: "quick", timeZone } });

    if (opened.status !== "ready" || !opened.placement.attempt) {
      throw new Error("Expected the other client's course attempt");
    }

    expect(opened.placement.next?.itemId).toBe(itemId);

    const { id: attemptId, part } = opened.placement.attempt;
    const input = { answer, durationMs: 1000, itemId, timeZone };

    await expect(
      answerPlacementQuestion({ goalId, input: { ...input, attemptId, part } }),
    ).resolves.toMatchObject({ placement: { attempt: { answered: 1 } }, status: "ready" });

    await expect(answerPlacementQuestion({ goalId, input })).resolves.toStrictEqual({
      status: "invalidItem",
    });

    await expect(getGoalPlacement({ goalId })).resolves.toMatchObject({
      placement: {
        attempt: { answered: 1, id: attemptId, part },
        next: { itemId: expect.not.stringMatching(itemId) },
        status: "asking",
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
      placement: {
        attempt: {
          answered: 12,
          id,
          parts: 1,
          partsRemoved: 0,
          questions: 12,
          totalEstimatedMinutes: 6,
        },
        next: null,
        status: "done",
      },
    });

    await expect(
      finishGoalPlacement({ goalId: goal.id, input: { attemptId: id } }),
    ).resolves.toMatchObject({ completion: { finish: { answered: 12, end: "question_cap" } } });
  });

  it("rejects a finish for an older attempt after a retake starts", async () => {
    const user = await userFixture();
    const { goal } = await learnerGoalFixture({ itemsPerSkill: 2, phases: [12], userId: user.id });
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
      completion: {
        attempt: null,
        complete: true,
        finish: { partsLeft: 0 },
        result: { attemptId, lessonsSkipped: 0, partsRemoved: 3 },
      },
      status: "ready",
    });

    await expect(getGoalPlan(goal.id)).resolves.toMatchObject({
      plan: {
        placementTest: { attempt: null, result: { attemptId, partsRemoved: 3 }, state: "result" },
      },
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
      input: {
        answer: await pickInPlacement({ itemId: items[0]!.id }),
        attemptId,
        durationMs: 100,
        itemId: items[0]!.id,
      },
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

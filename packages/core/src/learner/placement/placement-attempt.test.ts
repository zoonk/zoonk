import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { itemFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { gradeOrder, parseOrderItem } from "../../sessions/_utils/order-items";
import { loadSessionPlacement } from "../../sessions/_utils/session-placement";
import { learnerGoalFixture } from "../_test-utils/learner-goal";
import { lowGuessTapItems } from "../_test-utils/placement-tap-items";
import { loadPlacementPlan } from "../_utils/goal-skill-graph";
import { answerPlacementQuestion } from "./answer-placement-question";
import { finishGoalPlacement } from "./finish-goal-placement";
import { startPlacementSitting } from "./start-placement-sitting";

describe("learn placement attempts", () => {
  it("resumes the same saved attempt and refuses a finish from the previous attempt", async () => {
    const user = await userFixture();
    const { goal } = await learnerGoalFixture({ itemsPerSkill: 1, phases: [1], userId: user.id });
    mockSession(user.id);

    const open = () => startPlacementSitting({ goalId: goal.id, input: { length: "quick" } });
    const first = await open();

    if (first.status !== "ready" || !first.placement.attempt) {
      throw new Error("Expected a saved attempt");
    }

    const attemptId = first.placement.attempt.id;
    await expect(open()).resolves.toMatchObject({ placement: { attempt: { id: attemptId } } });
    const finish = () => finishGoalPlacement({ goalId: goal.id, input: { attemptId, part: 1 } });

    await expect(finish()).resolves.toMatchObject({
      completion: { result: { attemptId } },
      status: "ready",
    });

    await expect(open()).resolves.toMatchObject({
      placement: { attempt: { id: expect.not.stringMatching(attemptId) }, result: { attemptId } },
    });

    await expect(finish()).resolves.toStrictEqual({ status: "staleAttempt" });
  });

  it("opens one language topic walk per completed whole-course assessment", async () => {
    const user = await userFixture();
    const { goal } = await learnerGoalFixture({ itemsPerSkill: 1, phases: [1], userId: user.id });

    await prisma.goal.update({
      data: { kind: "language", targetLanguage: "en" },
      where: { id: goal.id },
    });

    mockSession(user.id);

    const begin = () =>
      startPlacementSitting({ goalId: goal.id, input: { length: "wholeCourse" } });

    await expect(begin()).resolves.toStrictEqual({ status: "unavailable" });

    const assessmentId = randomUUID();

    await prisma.goal.update({
      data: {
        details: {
          levelTest: { attempt: { attemptId: assessmentId, result: { wholeCourseReady: true } } },
        },
      },
      where: { id: goal.id },
    });

    const opened = await begin();

    if (opened.status !== "ready" || !opened.placement.attempt) {
      throw new Error("Expected the language topic walk");
    }

    const attemptId = opened.placement.attempt.id;
    await expect(begin()).resolves.toMatchObject({ placement: { attempt: { id: attemptId } } });

    await expect(
      finishGoalPlacement({ goalId: goal.id, input: { attemptId } }),
    ).resolves.toMatchObject({
      completion: { attempt: { id: attemptId, partComplete: true } },
      status: "ready",
    });

    const resumed = await begin();
    expect(resumed).toMatchObject({ placement: { attempt: { id: attemptId, part: 2 } } });

    if (resumed.status !== "ready" || !resumed.placement.next) {
      throw new Error("Expected the first topic question");
    }

    await answerPlacementQuestion({
      goalId: goal.id,
      input: {
        answer: { dontKnow: true },
        attemptId,
        durationMs: 1000,
        itemId: resumed.placement.next.itemId,
        part: 2,
      },
    });

    await expect(
      finishGoalPlacement({ goalId: goal.id, input: { attemptId, part: 2 } }),
    ).resolves.toMatchObject({ completion: { result: { attemptId } }, status: "ready" });

    await expect(begin()).resolves.toMatchObject({
      placement: { attempt: null, result: { attemptId } },
    });
  });

  it("carries a partial Quick confirmation into a session after week one", async () => {
    const user = await userFixture();

    const { goal, items, skills } = await learnerGoalFixture({
      itemsPerSkill: 1,
      phases: [1],
      userId: user.id,
    });

    const taps = await lowGuessTapItems(skills[0]!.id);
    mockSession(user.id);

    const begin = await startPlacementSitting({ goalId: goal.id, input: { length: "quick" } });

    if (begin.status !== "ready" || !begin.placement.attempt) {
      throw new Error("Expected a Quick attempt");
    }

    const attemptId = begin.placement.attempt.id;

    await answerPlacementQuestion({
      goalId: goal.id,
      input: { answer: { selectedIndex: 0 }, attemptId, durationMs: 1000, itemId: items[0]!.id },
    });

    await expect(
      finishGoalPlacement({ goalId: goal.id, input: { attemptId } }),
    ).resolves.toMatchObject({ completion: { result: { lessonsSkipped: 0 } }, status: "ready" });

    const [current, goalPlan] = await Promise.all([
      prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
      loadPlacementPlan(goal.id),
    ]);

    const now = new Date(Date.now() + 14 * MS_PER_DAY);
    const localDate = getDateInTimeZone({ date: now, timeZone: "UTC" });

    const selected = await loadSessionPlacement({
      context: { goal: current, localDate, now, timeZone: "UTC", userId: user.id },
      isReviewDay: false,
      plan: {
        finalStretchStart: null,
        goalPlan,
        graph: { phases: [], skills: [] },
        listeningSkillIds: new Set(),
        settings: {},
        skills: goalPlan.skills,
        structure: null,
      },
      used: new Set(),
    });

    expect(selected).toHaveLength(1);
    expect(taps.map(({ item }) => item.id)).toContain(selected[0]);
  });

  it("skips the lesson on the plan while retaining the shown session's active and pending blocks", async () => {
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
          gradeOrder({ answer: { dontKnow: true }, item: parsed }).correctAnswer,
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

    await expect(
      finishGoalPlacement({ goalId: goal.id, input: { attemptId } }),
    ).resolves.toMatchObject({
      completion: { result: { lessonsSkipped: 1 }, testedOutPlanItemIds: [item.id] },
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

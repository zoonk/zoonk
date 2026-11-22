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
import { loadTodayPlanChange } from "../../plans/_utils/today-plan-change";
import { decidePlanChange } from "../../plans/decide-plan-change";
import { getGoalPlan } from "../../plans/get-goal-plan";
import { refreshTestedOutPlan } from "../../plans/refresh-tested-out-plan";
import { gradeOrder, parseOrderItem } from "../../sessions/_utils/order-items";
import { loadSessionPlacement } from "../../sessions/_utils/session-placement";
import { answerOnboardingQuestion } from "../../view-models/onboarding/answer-onboarding-question";
import { learnerGoalFixture } from "../_test-utils/learner-goal";
import { lowGuessTapItems, placementItemBank } from "../_test-utils/placement-tap-items";
import { loadPlacementPlan } from "../_utils/goal-skill-graph";
import { answerPlacementQuestion } from "./answer-placement-question";
import { finishGoalPlacement } from "./finish-goal-placement";
import { getGoalPlacement } from "./get-goal-placement";
import { startPlacementSitting } from "./start-placement-sitting";

describe("learn placement attempts", () => {
  it("uses the same per-question estimate on the plan and at a whole-course part break", async () => {
    const user = await userFixture();

    const { goal, skills } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [4],
      userId: user.id,
    });

    const bank = await placementItemBank(skills.map(({ id }) => id));
    const answers = new Map(bank.flat().map(({ answer, item }) => [item.id, answer]));
    mockSession(user.id);

    const started = await startPlacementSitting({
      goalId: goal.id,
      input: { length: "wholeCourse" },
    });

    if (started.status !== "ready" || !started.placement.attempt || !started.placement.next) {
      throw new Error("Expected a whole-course question");
    }

    const { id: attemptId } = started.placement.attempt;
    const durations = [30_000, 30_000, 30_000, 30_000, 60_000];

    const send = async (itemId: string, [durationMs, ...remaining]: number[]): Promise<void> => {
      const answer = answers.get(itemId);

      if (!answer || durationMs === undefined) {
        throw new Error("Expected an answer to the next question");
      }

      const result = await answerPlacementQuestion({
        goalId: goal.id,
        input: { answer, attemptId, durationMs, itemId },
      });

      if (remaining.length > 0 && result.status === "ready" && result.placement.next) {
        await send(result.placement.next.itemId, remaining);
        return;
      }

      expect(remaining).toHaveLength(0);
      expect(result.status).toBe("ready");
    };

    await send(started.placement.next.itemId, durations);

    await expect(getGoalPlan(goal.id)).resolves.toMatchObject({
      plan: { placementTest: { attempt: { estimatedMinutes: 7 }, estimatedMinutes: 7 } },
    });

    await expect(
      finishGoalPlacement({ goalId: goal.id, input: { attemptId } }),
    ).resolves.toMatchObject({
      completion: { attempt: { estimatedMinutes: 7, partComplete: true } },
    });

    await expect(getGoalPlacement({ goalId: goal.id })).resolves.toMatchObject({
      placement: { attempt: { estimatedMinutes: 7 } },
    });
  });

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

  it.each(["learn", "language"] as const)(
    "completes %s onboarding after part one and resumes part two",
    async (kind) => {
      const user = await userFixture();
      const { goal } = await learnerGoalFixture({ itemsPerSkill: 1, phases: [1], userId: user.id });
      const assessmentId = randomUUID();

      await prisma.goal.update({
        data: {
          details:
            kind === "language"
              ? {
                  levelTest: {
                    attempt: { attemptId: assessmentId, result: { wholeCourseReady: true } },
                  },
                }
              : {},
          kind,
        },
        where: { id: goal.id },
      });

      mockSession(user.id);

      const begin = () =>
        startPlacementSitting({ goalId: goal.id, input: { length: "wholeCourse" } });

      const opened = await begin();

      if (opened.status !== "ready" || !opened.placement.attempt) {
        throw new Error("Expected a whole-course attempt");
      }

      const attemptId = opened.placement.attempt.id;

      const completeStep = (id: string) =>
        answerOnboardingQuestion({
          goalId: goal.id,
          input: { attemptId: id, question: "placement" },
        });

      await expect(completeStep(attemptId)).resolves.toMatchObject({ status: "invalid" });

      await expect(
        finishGoalPlacement({ goalId: goal.id, input: { attemptId, part: 1 } }),
      ).resolves.toMatchObject({
        completion: { attempt: { id: attemptId, partComplete: true } },
        status: "ready",
      });

      await expect(completeStep(randomUUID())).resolves.toMatchObject({ status: "invalid" });
      await expect(completeStep(attemptId)).resolves.toMatchObject({ status: "saved" });
      await expect(completeStep(attemptId)).resolves.toMatchObject({ status: "saved" });

      await expect(prisma.goal.findUnique({ where: { id: goal.id } })).resolves.toMatchObject({
        details: { answered: ["placement"] },
      });

      await expect(begin()).resolves.toMatchObject({
        placement: { attempt: { id: attemptId, part: 2 } },
      });
    },
  );

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

    const { placementItemIds: selected } = await loadSessionPlacement({
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
      signals: { earlyReviewSkillIds: [], easySkillIds: [], hardRecheckSkillIds: [] },
      used: new Set(),
    });

    expect(selected).toHaveLength(1);
    expect(taps.map(({ item }) => item.id)).toContain(selected[0]);
  });

  it.each([{ movedOn: false }, { movedOn: true }])(
    "records the skip and keeps the shown session and Undo after finish (learner retook: $movedOn)",
    async ({ movedOn }) => {
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

      const nextAttempt = movedOn
        ? await startPlacementSitting({ goalId: goal.id, input: { length: "quick" } })
        : null;

      const nextAttemptId =
        nextAttempt?.status === "ready" ? nextAttempt.placement.attempt?.id : null;

      expect(Boolean(nextAttemptId && nextAttemptId !== attemptId)).toBe(movedOn);

      await refreshTestedOutPlan({ goalId: goal.id, userId: user.id });

      await expect(
        prisma.planChange.count({ where: { kind: "testedOut", planId: item.planId } }),
      ).resolves.toBe(1);

      await expect(finish()).resolves.toMatchObject(
        movedOn ? { status: "staleAttempt" } : { completion: { changeId } },
      );

      await expect(loadTodayPlanChange({ goal, now: new Date() })).resolves.toMatchObject({
        canUndo: true,
        id: changeId,
      });

      await expect(getGoalPlan(goal.id)).resolves.toMatchObject({
        plan: {
          changes: expect.arrayContaining([
            expect.objectContaining({ canUndo: true, id: changeId }),
          ]),
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
    },
  );
});

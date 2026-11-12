import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { skillPrerequisiteFixture } from "@zoonk/testing/fixtures/skills";
import { describe, expect, it } from "vitest";
import { runDeferredWork } from "../../_test-utils/deferred-work";
import { listOwed } from "../../_test-utils/follow-ups";
import {
  LEARNER_LOCK,
  holdLearnerLock,
  waitForBlockedStatement,
} from "../../_test-utils/learner-lock";
import { mockSession } from "../../_test-utils/mock-session";
import { analytics } from "../../_test-utils/test-boundaries";
import { isGoalInPlacementWeek } from "../../lookahead/placement-week";
import { changeGoalPlan } from "../../plans/change-goal-plan";
import { decidePlanChange } from "../../plans/decide-plan-change";
import { getGoalPlan } from "../../plans/get-goal-plan";
import {
  PLAN_SHOWN,
  type TestPlacement,
  examTestGoalFixture,
  shortPlanExamGoalFixture,
  startSitting,
} from "../_test-utils/exam-test-goal";
import { answerPlacementQuestion } from "./answer-placement-question";
import { finishGoalPlacement } from "./finish-goal-placement";
import { readFocusTestRecord } from "./focus-test-state";
import { getGoalPlacement } from "./get-goal-placement";
import { startPlacementSitting } from "./start-placement-sitting";

const DONT_KNOW = { dontKnow: true } as const;
const RIGHT = { selectedIndex: 0 };

const THREE_SUBJECTS = [
  { name: "Português", questions: 8 },
  { name: "Direito Administrativo", questions: 12 },
  { name: "Informática", questions: 4 },
];

function manySubjects(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    name: `Matéria ${String(index + 1).padStart(2, "0")}`,
    questions: count - index,
  }));
}

async function read(goalId: string): Promise<TestPlacement> {
  const result = await getGoalPlacement({ goalId });

  if (result.status !== "ready") {
    throw new Error(`No placement: ${result.status}`);
  }

  return result.placement;
}

async function answer({
  given = RIGHT,
  goalId,
  placement,
}: {
  given?: typeof DONT_KNOW | typeof RIGHT;
  goalId: string;
  placement: TestPlacement;
}): Promise<TestPlacement> {
  const result = await answerPlacementQuestion({
    goalId,
    input: { answer: given, durationMs: 30_000, itemId: placement.next?.itemId ?? "" },
  });

  if (result.status !== "ready") {
    throw new Error(`The answer wasn't taken: ${result.status}`);
  }

  return result.placement;
}

async function answerTimes({
  given,
  goalId,
  placement,
  times,
}: {
  given?: typeof DONT_KNOW | typeof RIGHT;
  goalId: string;
  placement: TestPlacement;
  times: number;
}): Promise<TestPlacement> {
  let current = placement;

  for (let turn = 0; turn < times; turn += 1) {
    // oxlint-disable-next-line no-await-in-loop -- Each answer decides the next question.
    current = await answer({ given, goalId, placement: current });
  }

  return current;
}

async function finish(goalId: string) {
  const result = await finishGoalPlacement({ goalId, input: {} });

  if (result.status !== "ready") {
    throw new Error(`Placement didn't finish: ${result.status}`);
  }

  return result.completion;
}

async function readRecord(goalId: string) {
  return readFocusTestRecord(await prisma.goal.findUniqueOrThrow({ where: { id: goalId } }));
}

describe("an exam goal's Focus test", () => {
  it("invites with the count and time its subjects fit, and asks nothing before a start", async () => {
    const { goal } = await examTestGoalFixture({ subjects: THREE_SUBJECTS });

    await expect(read(goal.id)).resolves.toMatchObject({
      dayBudgetSpent: 0,
      focusTest: {
        checkpoint: null,
        offer: { minutes: 12 },
        sessionQuestions: "off",
        sitting: null,
        subjects: THREE_SUBJECTS.map(({ name }) => ({
          asked: 0,
          key: name,
          name,
          part: null,
          right: 0,
          shortName: null,
          state: "notAsked",
        })),
        suggestsFocus: true,
      },
      next: null,
      started: false,
      status: "done",
    });

    await expect(readRecord(goal.id)).resolves.toBeNull();
  });

  it("promises what fits fifteen minutes on a 24-subject exam", async () => {
    const { goal } = await examTestGoalFixture({ subjects: manySubjects(24) });
    const placement = await read(goal.id);

    expect(placement.focusTest?.offer).toStrictEqual({ minutes: 15 });
    expect(placement.focusTest?.subjects).toHaveLength(24);

    const started = await startSitting(goal.id);

    expect(started.focusTest?.sitting).toMatchObject({ minutes: 15, questions: 15 });
  });

  it("opens one sitting however often it starts, and asks each subject before any twice, the heaviest first", async () => {
    const { goal, subjectOf } = await examTestGoalFixture({
      subjects: THREE_SUBJECTS.map((subject) => ({ ...subject, skills: 2 })),
    });

    const first = await startSitting(goal.id);

    expect(first).toMatchObject({
      focusTest: {
        offer: { minutes: 12 },
        sessionQuestions: "on",
        sitting: {
          answered: 0,
          hint: null,
          minutes: 12,
          questions: 12,
          subject: { name: "Direito Administrativo" },
        },
      },
      started: false,
      status: "asking",
    });

    const opened = await readRecord(goal.id);
    expect(opened?.sitting).toMatchObject({ kind: "first", questions: 12 });
    await startSitting(goal.id);

    await expect(readRecord(goal.id)).resolves.toMatchObject({
      sitting: { id: opened?.sitting?.id },
      startedAt: opened?.startedAt,
    });

    const second = await answer({ goalId: goal.id, placement: first });
    const third = await answer({ goalId: goal.id, placement: second });
    const fourth = await answer({ goalId: goal.id, placement: third });

    expect(
      [first, second, third, fourth].map((placement) => subjectOf(placement.next?.skillId)),
    ).toStrictEqual([
      "Direito Administrativo",
      "Português",
      "Informática",
      "Direito Administrativo",
    ]);

    expect(fourth).toMatchObject({
      dayBudgetSpent: 3 / 12,
      focusTest: {
        offer: null,
        sitting: { answered: 3, minutes: 9, questions: 12 },
        subjects: [{ asked: 1 }, { asked: 1 }, { asked: 1 }],
      },
      started: true,
      status: "asking",
    });
  });

  it("asks an unanswered subject even when another subject settles its starting point", async () => {
    const { goal, skills, subjectOf } = await examTestGoalFixture({
      subjects: [
        { name: "Math", questions: 10 },
        { name: "Physics", questions: 5 },
      ],
    });

    await skillPrerequisiteFixture({ prerequisiteId: skills[0]!.id, skillId: skills[1]!.id });

    const first = await startSitting(goal.id);
    expect(subjectOf(first.next?.skillId)).toBe("Math");

    const second = await answer({ given: DONT_KNOW, goalId: goal.id, placement: first });

    expect(subjectOf(second.next?.skillId)).toBe("Physics");

    expect(second).toMatchObject({
      areas: [{ confident: true }, { confident: true }],
      focusTest: { sessionQuestions: "on" },
      status: "asking",
    });

    const last = await answer({ given: DONT_KNOW, goalId: goal.id, placement: second });

    expect(last).toMatchObject({
      focusTest: { sessionQuestions: "off", subjects: [{ asked: 1 }, { asked: 1 }] },
      next: null,
      status: "done",
    });
  });

  it("counts an answer sent twice once", async () => {
    const { goal, user } = await examTestGoalFixture({ subjects: THREE_SUBJECTS });
    const first = await startSitting(goal.id);

    const [repeated] = await Promise.all([
      answer({ goalId: goal.id, placement: first }),
      answer({ goalId: goal.id, placement: first }),
    ]);

    expect(repeated.focusTest?.sitting).toMatchObject({ answered: 1, minutes: 11 });
    await expect(prisma.attempt.count({ where: { userId: user.id } })).resolves.toBe(1);
  });

  it("keeps all concurrent answers in the plan summary and settles their time once", async () => {
    const { goal, items, skills, user } = await examTestGoalFixture({
      goal: PLAN_SHOWN,
      subjects: THREE_SUBJECTS,
    });

    await startSitting(goal.id);

    await Promise.all(
      skills.map((skill) =>
        answerPlacementQuestion({
          goalId: goal.id,
          input: {
            answer: DONT_KNOW,
            durationMs: 30_000,
            itemId: items.find((item) => item.skillId === skill.id)?.id ?? "",
          },
        }),
      ),
    );

    await expect(readRecord(goal.id)).resolves.toMatchObject({
      sitting: { answered: 3 },
      summary: { asked: 3, unasked: 0 },
    });

    await Promise.all([finish(goal.id), finish(goal.id)]);

    await expect(
      prisma.learningEvent.findMany({
        select: { incorrectAnswers: true, seconds: true },
        where: { lessonKind: "focusTest", userId: user.id },
      }),
    ).resolves.toStrictEqual([{ incorrectAnswers: 3, seconds: 90 }]);
  });

  it("starts a continuation directly from an ended sitting and keeps its result", async () => {
    const { goal, user } = await examTestGoalFixture({
      goal: PLAN_SHOWN,
      subjects: [{ name: "Biologia", questions: 10, skills: 4 }],
    });

    const first = await startSitting(goal.id);
    const ended = await answerTimes({ goalId: goal.id, placement: first, times: 4 });
    expect(ended).toMatchObject({ next: null, status: "done" });

    const continued = await startSitting(goal.id);

    expect(continued).toMatchObject({
      focusTest: {
        sitting: { answered: 0, minutes: 4, questions: 4 },
        subjects: [{ asked: 4, right: 4 }],
      },
      next: expect.anything(),
      status: "asking",
    });

    await expect(readRecord(goal.id)).resolves.toMatchObject({ sitting: { kind: "continuation" } });

    await expect(
      prisma.learningEvent.findMany({ where: { lessonKind: "focusTest", userId: user.id } }),
    ).resolves.toMatchObject([{ correctAnswers: 4, seconds: 120 }]);
  });

  it("ends at its promised count; finishing it shows the result and offers to continue", async () => {
    const { goal, user } = await examTestGoalFixture({
      goal: PLAN_SHOWN,
      subjects: [{ name: "Biologia", questions: 10, skills: 4 }],
    });

    const flush = runDeferredWork();
    const first = await startSitting(goal.id);

    expect(first.focusTest?.sitting).toMatchObject({ minutes: 4, questions: 4 });

    const last = await answerTimes({ goalId: goal.id, placement: first, times: 4 });

    expect(last).toMatchObject({
      dayBudgetSpent: 1,
      dayBudgetUsed: true,
      focusTest: { sitting: { answered: 4, minutes: 0, subject: null } },
      next: null,
      status: "done",
    });

    const completion = await finish(goal.id);
    await flush();

    expect(completion.focusTest).toMatchObject({
      checkpoint: { focus: null, lessonsSkipped: completion.testedOutPlanItemIds.length },
      offer: { minutes: 4 },
      sessionQuestions: "on",
      sitting: null,
      subjects: [{ asked: 4, right: 4, state: "answered" }],
    });

    expect(completion.testedOutPlanItemIds.length).toBeGreaterThan(0);

    expect(analytics.trackServerEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Focus Test Sitting Finished",
        properties: {
          answered: 4,
          dont_know: 0,
          duration_ms: 120_000,
          kind: "first",
          questions: 4,
        },
      }),
    );

    // The plan was already shown, so the sitting counts as study, once however often it's finished.
    await finish(goal.id);

    await expect(
      prisma.learningEvent.findMany({
        select: { correctAnswers: true, seconds: true },
        where: { lessonKind: "focusTest", userId: user.id },
      }),
    ).resolves.toStrictEqual([{ correctAnswers: 4, seconds: 120 }]);

    await expect(startSitting(goal.id)).resolves.toMatchObject({
      focusTest: { sitting: { answered: 0, questions: 4 } },
      status: "asking",
    });

    await expect(readRecord(goal.id)).resolves.toMatchObject({ sitting: { kind: "continuation" } });
  });

  it("finishes a sitting that is over when the learner starts the next", async () => {
    const { goal } = await examTestGoalFixture({
      subjects: [{ name: "Biologia", questions: 10, skills: 4 }],
    });

    const first = await startSitting(goal.id);
    await answerTimes({ goalId: goal.id, placement: first, times: 4 });

    const next = await startSitting(goal.id);

    expect(next).toMatchObject({
      focusTest: { checkpoint: { lessonsSkipped: expect.any(Number) }, sitting: { answered: 0 } },
      status: "asking",
    });

    await expect(readRecord(goal.id)).resolves.toMatchObject({ sitting: { kind: "continuation" } });
  });

  it.each(["start", "finish"] as const)(
    "%s closes only the sitting it observed before waiting for the learner lock",
    async (action) => {
      const { goal, user } = await examTestGoalFixture({
        subjects: [{ name: "Biologia", questions: 10, skills: 4 }],
      });

      const first = await startSitting(goal.id);
      await answerTimes({ goalId: goal.id, placement: first, times: 4 });
      const before = await readRecord(goal.id);
      const successorId = randomUUID();

      const lock = holdLearnerLock({
        beforeCommit: async (tx) => {
          await tx.goal.update({
            data: {
              details: {
                focusTest: {
                  ...before,
                  sitting: {
                    answered: 0,
                    id: successorId,
                    kind: "continuation",
                    questions: 4,
                    startedAt: new Date().toISOString(),
                  },
                },
              },
            },
            where: { id: goal.id },
          });
        },
        userId: user.id,
      });

      const holder = await lock.pid;

      const request = Promise.allSettled([
        action === "start" ? startSitting(goal.id) : finish(goal.id),
      ]);

      try {
        await waitForBlockedStatement(holder, LEARNER_LOCK);
      } finally {
        lock.release();
        await lock.done;
        await request;
      }

      await expect(request).resolves.toMatchObject([{ status: "fulfilled" }]);
      await expect(readRecord(goal.id)).resolves.toMatchObject({ sitting: { id: successorId } });
    },
  );

  it.each(["restore", "undo"] as const)(
    "reopens a skipped subject through %s after the other subjects settle",
    async (action) => {
      const { goal } = await shortPlanExamGoalFixture({
        goal: { ...PLAN_SHOWN, createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) },
      });

      await expect(
        changeGoalPlan({
          goalId: goal.id,
          input: {
            operations: [
              {
                areas: ["Português", "Informática", "Raciocínio", "Atualidades", "Ética"],
                kind: "skipAreas",
              },
            ],
          },
        }),
      ).resolves.toMatchObject({ status: "applied" });

      const first = await startSitting(goal.id);
      await answer({ given: DONT_KNOW, goalId: goal.id, placement: first });
      await finish(goal.id);

      await expect(readRecord(goal.id)).resolves.toMatchObject({
        summary: { complete: true, total: 1 },
      });

      await expect(
        changeGoalPlan({
          goalId: goal.id,
          input: { operations: [{ areas: ["Português"], kind: "restoreAreas" }] },
        }),
      ).resolves.toMatchObject({ status: "applied" });

      if (action === "undo") {
        const again = await changeGoalPlan({
          goalId: goal.id,
          input: { operations: [{ areas: ["Português"], kind: "skipAreas" }] },
        });

        if (again.status !== "applied" || !again.change) {
          throw new Error("Skip failed");
        }

        const undone = await decidePlanChange({
          changeId: again.change.id,
          goalId: goal.id,
          input: { status: "undone" },
        });

        if (undone.status !== "updated") {
          throw new Error(`Undo failed: ${undone.status}`);
        }
      }

      const beforeRead = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });

      await expect(getGoalPlan(goal.id)).resolves.toMatchObject({
        plan: { focusTest: { sessionQuestions: "on", state: "checked" } },
        status: "ready",
      });

      await expect(isGoalInPlacementWeek({ goalId: goal.id, timeZone: "UTC" })).resolves.toBe(true);

      await expect(
        prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
      ).resolves.toStrictEqual(beforeRead);
    },
  );

  it("ends once nothing useful is left to ask, and sessions ask no more", async () => {
    const { goal } = await examTestGoalFixture({ subjects: THREE_SUBJECTS.slice(0, 2) });
    const first = await startSitting(goal.id);

    const last = await answerTimes({
      given: DONT_KNOW,
      goalId: goal.id,
      placement: first,
      times: 2,
    });

    expect(last).toMatchObject({
      focusTest: { offer: null, sessionQuestions: "off", sitting: { answered: 2, minutes: 6 } },
      next: null,
      status: "done",
    });
  });

  it("ends early when the questions ready run out, and leaves the rest to sessions", async () => {
    const { goal } = await examTestGoalFixture({
      subjects: THREE_SUBJECTS.slice(0, 2).map((subject) => ({ ...subject, items: 1 })),
    });

    const first = await startSitting(goal.id);
    const last = await answerTimes({ goalId: goal.id, placement: first, times: 2 });

    expect(last).toMatchObject({
      focusTest: { sessionQuestions: "on", sitting: { answered: 2, minutes: 6 } },
      next: null,
      status: "done",
    });
  });

  it("hints that stopping is fine after five 'I don't know yet' in a row", async () => {
    const { goal } = await examTestGoalFixture({ subjects: manySubjects(7) });
    const first = await startSitting(goal.id);

    const fourth = await answerTimes({
      given: DONT_KNOW,
      goalId: goal.id,
      placement: first,
      times: 4,
    });

    expect(fourth.focusTest?.sitting?.hint).toBeNull();

    const fifth = await answer({ given: DONT_KNOW, goalId: goal.id, placement: fourth });
    expect(fifth.focusTest?.sitting?.hint).toBe("manyUnknown");

    const sixth = await answer({ goalId: goal.id, placement: fifth });
    expect(sixth.focusTest?.sitting?.hint).toBeNull();
  });

  it("skips for now without starting the test or asking in sessions", async () => {
    const { goal, user } = await examTestGoalFixture({ subjects: THREE_SUBJECTS });
    const completion = await finish(goal.id);

    expect(completion).toMatchObject({
      focusTest: {
        checkpoint: null,
        offer: { minutes: 12 },
        sessionQuestions: "off",
        sitting: null,
      },
      knownSkillIds: [],
      testedOutPlanItemIds: [],
    });

    await expect(readRecord(goal.id)).resolves.toMatchObject({ sitting: null, startedAt: null });

    await expect(
      prisma.learningEvent.count({ where: { lessonKind: "focusTest", userId: user.id } }),
    ).resolves.toBe(0);
  });

  it("has no 'from scratch', and no sitting for a goal that isn't an exam", async () => {
    const { goal } = await examTestGoalFixture({ subjects: THREE_SUBJECTS });

    await expect(
      finishGoalPlacement({ goalId: goal.id, input: { fromScratch: true } }),
    ).resolves.toStrictEqual({ status: "unavailable" });

    await prisma.goal.update({ data: { kind: "learn" }, where: { id: goal.id } });

    await expect(startPlacementSitting({ goalId: goal.id, input: {} })).resolves.toStrictEqual({
      status: "unavailable",
    });

    await expect(read(goal.id)).resolves.toMatchObject({ focusTest: null });
  });

  it("has the questions written for a learner who passed placement by, owed once", async () => {
    const { goal, user } = await examTestGoalFixture({
      goal: { details: { answered: ["target", "level", "targetDate"], level: "none" } },
      subjects: THREE_SUBJECTS.map((subject) => ({ ...subject, items: 0 })),
    });

    await expect(read(goal.id)).resolves.toMatchObject({
      focusTest: { offer: { minutes: 12 }, sessionQuestions: "off" },
    });

    const started = await startSitting(goal.id);

    expect(started).toMatchObject({
      focusTest: { sitting: { answered: 0, questions: 12 } },
      next: null,
      status: "waitingForQuestions",
    });

    await startSitting(goal.id);

    await expect(listOwed(user.id)).resolves.toStrictEqual([
      {
        input: { goalId: goal.id, waitsForNotice: true },
        key: goal.id,
        kind: "preparePlacementItems",
      },
    ]);

    await expect(
      prisma.plan.findUniqueOrThrow({
        select: { placementPreparedAt: true },
        where: { goalId: goal.id },
      }),
    ).resolves.toStrictEqual({ placementPreparedAt: null });
  });

  it("doesn't count a sitting's time while the plan hasn't been shown", async () => {
    const { goal, user } = await examTestGoalFixture({ subjects: THREE_SUBJECTS });

    const first = await startSitting(goal.id);
    await answer({ goalId: goal.id, placement: first });
    await finish(goal.id);

    await expect(
      prisma.learningEvent.count({ where: { lessonKind: "focusTest", userId: user.id } }),
    ).resolves.toBe(0);
  });
});

async function answerHeaviest(goalId: string, given: typeof DONT_KNOW | typeof RIGHT) {
  const first = await startSitting(goalId);
  await answer({ given, goalId, placement: first });
  return finish(goalId);
}

describe("the Focus test's suggested focus", () => {
  const SIX_SUBJECTS = manySubjects(6);

  it("says saving the daily time sets it while that question is still ahead", async () => {
    const { goal, plan } = await examTestGoalFixture({ coveredShare: 0.6, subjects: SIX_SUBJECTS });

    const completion = await answerHeaviest(goal.id, DONT_KNOW);

    expect(completion.focusTest?.checkpoint?.focus).toStrictEqual({
      proposal: null,
      rows: ["Matéria 01", "Matéria 02"].map((name) => ({
        areas: [name],
        subject: { key: name, name, shortName: null },
      })),
      state: "ifTimeShort",
    });

    await expect(prisma.planChange.count({ where: { planId: plan.id } })).resolves.toBe(0);
  });

  it("has no focus without a date, with one subject, or on a plan whose time covers everything", async () => {
    const covered = await examTestGoalFixture({
      coveredShare: 1,
      goal: PLAN_SHOWN,
      subjects: SIX_SUBJECTS,
    });

    const undated = await examTestGoalFixture({
      goal: { targetDate: null },
      subjects: SIX_SUBJECTS,
    });

    const fromUndated = await answerHeaviest(undated.goal.id, DONT_KNOW);

    expect(fromUndated.focusTest).toMatchObject({
      checkpoint: { focus: null },
      suggestsFocus: false,
    });

    mockSession(covered.user.id);

    const fromCovered = await answerHeaviest(covered.goal.id, DONT_KNOW);

    expect(fromCovered.focusTest).toMatchObject({
      checkpoint: { focus: null },
      suggestsFocus: true,
    });
  });
});

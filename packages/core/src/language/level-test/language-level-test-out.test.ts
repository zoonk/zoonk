import { prisma } from "@zoonk/db";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { listeningSetFixture } from "@zoonk/testing/fixtures/listening";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { describe, expect, it } from "vitest";
import { runDeferredWork } from "../../_test-utils/deferred-work";
import { mockSession } from "../../_test-utils/mock-session";
import { analytics } from "../../_test-utils/test-boundaries";
import { loadTodayPlanChange } from "../../plans/_utils/today-plan-change";
import { decidePlanChange } from "../../plans/decide-plan-change";
import { getGoalPlan } from "../../plans/get-goal-plan";
import { finishLanguageLevelTestOut } from "./finish-language-level-test-out";
import {
  type LanguageLevelTestOutResult,
  answerLanguageLevelTestOut,
  getLanguageLevelTestOut,
  getNextAvailableLevelTestOut,
  startLanguageLevelTestOut,
} from "./language-level-test-out";
import { startLanguageLevelTest } from "./start-language-level-test";

/** `LanguageLevelTestOut.next` in the API contract; native clients reject any other field. */
const PUBLISHED_QUESTION_FIELDS = [
  "context",
  "format",
  "image",
  "itemId",
  "key",
  "left",
  "options",
  "question",
  "right",
  "select",
  "set",
  "skill",
  "skillId",
  "visual",
];

async function writeTapQuestions({ setId, skillId }: { setId?: string; skillId: string }) {
  const quick = choiceItemContent();

  const all = {
    ...choiceItemContent(),
    options: Array.from({ length: 5 }, (_, index) => ({
      isCorrect: index < 2,
      misconception: null,
      reason: "Explanation.",
      text: `Option ${index + 1}`,
    })),
    select: "all",
  };

  return Promise.all(
    [quick, all, all, all].map((content, setPosition) =>
      itemFixture({ content, setId, setPosition: setId ? setPosition : null, skillId }),
    ),
  );
}

async function takeTest({
  goalId,
  seenSkills,
  view,
}: {
  goalId: string;
  seenSkills: Set<"reading" | "listening">;
  view: Extract<LanguageLevelTestOutResult, { status: "ready" }>["test"];
}) {
  const { next } = view;

  if (!next) {
    return;
  }

  seenSkills.add(next.skill);

  expect(Object.keys(next).toSorted()).toStrictEqual(PUBLISHED_QUESTION_FIELDS);
  expect(next.key).toBeNull();
  expect(Boolean(next.set?.listening?.audio?.url)).toBe(next.skill === "listening");

  const shownAt = (text: string) => next.options?.indexOf(text) ?? -1;

  const answer =
    next.select === "all"
      ? { selectedIndexes: ["Option 1", "Option 2"].map((text) => shownAt(text)) }
      : { selectedIndex: shownAt("Right answer") };

  const result = await answerLanguageLevelTestOut({
    goalId,
    input: { answer, attemptId: view.attemptId, durationMs: 1500, itemId: next.itemId },
  });

  if (result.status !== "ready") {
    throw new Error(`Answer returned ${result.status}`);
  }

  await takeTest({ goalId, seenSkills, view: result.test });
}

describe("a language level test-out", () => {
  it("offers the next eligible level after the learner finishes or tests out of their own level", async () => {
    const { goal, items, skills, user } = await languageGoalFixture();

    await Promise.all([
      prisma.goal.update({ data: { details: { level: "B2" } }, where: { id: goal.id } }),
      prisma.skill.updateMany({
        data: { cefrLevel: "B2" },
        where: { id: { in: skills.slice(0, 2).map(({ id }) => id) } },
      }),
      prisma.skill.updateMany({
        data: { cefrLevel: "C1" },
        where: { id: { in: skills.slice(2).map(({ id }) => id) } },
      }),
    ]);

    mockSession(user.id);
    await expect(getNextAvailableLevelTestOut(goal.id)).resolves.toBe("B2");

    await Promise.all(
      items
        .slice(0, 2)
        .map(({ id }, index) =>
          prisma.planItem.update({
            data: { completedAt: new Date(), status: index === 0 ? "done" : "testedOut" },
            where: { id },
          }),
        ),
    );

    await expect(getNextAvailableLevelTestOut(goal.id)).resolves.toBe("C1");

    await expect(getGoalPlan(goal.id)).resolves.toMatchObject({
      plan: { placementTest: { nextTestOutLevel: "C1" } },
    });

    await expect(
      startLanguageLevelTestOut({ goalId: goal.id, level: "C1" }),
    ).resolves.toMatchObject({ status: "ready", test: { level: "C1", preparing: true } });
  });

  it("still offers an open test-out after today's misses rule its level out of a new one", async () => {
    const { goal, skills, user } = await languageGoalFixture();
    const [reading, listening] = skills;

    if (!reading || !listening) {
      throw new Error("Expected two topics");
    }

    const media = await mediaAssetFixture({ durationMs: 30_000, kind: "audio" });
    const set = await listeningSetFixture({ mediaAssetId: media.id });

    await Promise.all([
      prisma.skill.updateMany({
        data: { cefrLevel: "C2" },
        where: { id: { in: [reading.id, listening.id] } },
      }),
      writeTapQuestions({ skillId: reading.id }),
      writeTapQuestions({ setId: set.id, skillId: listening.id }),
    ]);

    mockSession(user.id);
    const started = await startLanguageLevelTestOut({ goalId: goal.id, level: "C2" });

    if (started.status !== "ready") {
      throw new Error(`Start returned ${started.status}`);
    }

    const missed = new Set<string>();
    let view = started.test;

    while (view.next && missed.size < 2) {
      const { next } = view;
      missed.add(next.skill);
      const shownAt = (text: string) => next.options?.indexOf(text) ?? -1;

      const answer =
        next.select === "all"
          ? { selectedIndexes: [shownAt("Option 5")] }
          : { selectedIndex: shownAt("Wrong answer") };

      // oxlint-disable-next-line no-await-in-loop -- Each answer reads the question the last one left.
      const result = await answerLanguageLevelTestOut({
        goalId: goal.id,
        input: { answer, attemptId: view.attemptId, durationMs: 1500, itemId: next.itemId },
      });

      if (result.status !== "ready") {
        throw new Error(`Answer returned ${result.status}`);
      }

      view = result.test;
    }

    expect(missed).toStrictEqual(new Set(["reading", "listening"]));
    expect(view.next).not.toBeNull();

    await expect(getNextAvailableLevelTestOut(goal.id)).resolves.toBe("C2");

    await expect(getGoalPlan(goal.id)).resolves.toMatchObject({
      plan: { placementTest: { nextTestOutLevel: "C2", state: "continue" } },
    });

    await expect(
      startLanguageLevelTestOut({ goalId: goal.id, level: "C2" }),
    ).resolves.toMatchObject({ status: "ready", test: { attemptId: started.test.attemptId } });
  });

  it("keeps B2 in the plan when a B1 learner's B2 lessons are still stand-ins", async () => {
    const { goal, items, plan, skills, user } = await languageGoalFixture();
    const days = [new Date("2026-11-18"), new Date("2026-11-19")];
    const [studied, ahead] = [items.slice(0, 2), items.slice(2)];

    await Promise.all([
      prisma.goal.update({ data: { details: { level: "B1" } }, where: { id: goal.id } }),
      ...studied.map(({ id }, index) =>
        prisma.planItem.update({
          data: { completedAt: days[index], status: "done" },
          where: { id },
        }),
      ),
      prisma.skill.updateMany({
        data: { cefrLevel: "B2" },
        where: { id: { in: skills.slice(2).map(({ id }) => id) } },
      }),
      prisma.planItem.updateMany({
        data: { chapterId: null, lessonId: null, lessons: 1 },
        where: { id: { in: ahead.map(({ id }) => id) } },
      }),
    ]);

    mockSession(user.id);

    await expect(getGoalPlan(goal.id)).resolves.toMatchObject({
      plan: { placementTest: { kind: "language", nextTestOutLevel: null } },
      status: "ready",
    });

    const started = await startLanguageLevelTestOut({ goalId: goal.id, level: "B2" });

    expect(started).toMatchObject({
      status: "ready",
      test: { answered: 0, level: "B2", next: null, preparing: false, result: null, total: 0 },
    });

    if (started.status !== "ready") {
      throw new Error(`Start returned ${started.status}`);
    }

    await expect(
      startLanguageLevelTestOut({ goalId: goal.id, level: "B2" }),
    ).resolves.toStrictEqual(started);

    await expect(
      getLanguageLevelTestOut({ attemptId: started.test.attemptId, goalId: goal.id }),
    ).resolves.toStrictEqual(started);

    await expect(
      prisma.planItem.count({ where: { planId: plan.id, status: "testedOut" } }),
    ).resolves.toBe(0);

    await expect(
      prisma.followUp.count({ where: { kind: "prepareLevelTestOut", userId: user.id } }),
    ).resolves.toBe(0);

    await Promise.all(
      ahead.map(({ chapterId, id, lessonId }) =>
        prisma.planItem.update({ data: { chapterId, lessonId, lessons: null }, where: { id } }),
      ),
    );

    await expect(getGoalPlan(goal.id)).resolves.toMatchObject({
      plan: { placementTest: { kind: "language", nextTestOutLevel: "B2" } },
      status: "ready",
    });

    await expect(
      startLanguageLevelTestOut({ goalId: goal.id, level: "B2" }),
    ).resolves.toMatchObject({ status: "ready", test: { level: "B2", preparing: true } });
  });

  it("confirms one topic in each assessed skill and only skips lessons that teach them", async () => {
    const { goal, items, skills, user } = await languageGoalFixture();
    const [reading, listening, untested] = skills;

    if (!reading || !listening || !untested) {
      throw new Error("Expected three topics");
    }

    const media = await mediaAssetFixture({ durationMs: 30_000, kind: "audio" });
    const set = await listeningSetFixture({ mediaAssetId: media.id });

    await Promise.all([
      prisma.skill.updateMany({
        data: { cefrLevel: "C2" },
        where: { id: { in: [reading.id, listening.id, untested.id] } },
      }),
      writeTapQuestions({ skillId: reading.id }),
      writeTapQuestions({ setId: set.id, skillId: listening.id }),
    ]);

    mockSession(user.id);
    const flush = runDeferredWork();
    const started = await startLanguageLevelTestOut({ goalId: goal.id, level: "C2" });

    if (started.status !== "ready") {
      throw new Error(`Start returned ${started.status}`);
    }

    expect(started.test).toMatchObject({ answered: 0, level: "C2", total: 8 });

    await expect(startLanguageLevelTest({ goalId: goal.id })).resolves.toMatchObject({
      status: "invalid",
    });

    const seenSkills = new Set<"reading" | "listening">();
    await takeTest({ goalId: goal.id, seenSkills, view: started.test });
    expect(seenSkills).toStrictEqual(new Set(["reading", "listening"]));

    const input = { attemptId: started.test.attemptId, goalId: goal.id };
    const finished = await finishLanguageLevelTestOut(input);

    expect(finished).toMatchObject({
      status: "ready",
      test: {
        answered: 8,
        next: null,
        result: {
          changeId: expect.any(String),
          lessonsSkipped: 2,
          topicsSkipped: [reading.id, listening.id],
        },
      },
    });

    await expect(finishLanguageLevelTestOut(input)).resolves.toStrictEqual(finished);

    if (finished.status !== "ready" || !finished.test.result?.changeId) {
      throw new Error("Expected the finish's Undo ID");
    }

    const { changeId } = finished.test.result;

    await expect(loadTodayPlanChange({ goal, now: new Date() })).resolves.toMatchObject({
      canUndo: true,
      id: changeId,
    });

    const statuses = await prisma.planItem.findMany({
      select: { id: true, status: true },
      where: { id: { in: items.slice(0, 3).map(({ id }) => id) } },
    });

    const statusByItem = new Map(statuses.map(({ id, status }) => [id, status]));

    expect(items.slice(0, 3).map(({ id }) => statusByItem.get(id))).toStrictEqual([
      "testedOut",
      "testedOut",
      "todo",
    ]);

    await expect(
      decidePlanChange({ changeId, goalId: goal.id, input: { status: "undone" } }),
    ).resolves.toMatchObject({ status: "updated" });

    await flush();

    const events = analytics.trackServerEvent.mock.calls.flat();

    expect(events.filter((event) => event.name === "Test Started")).toMatchObject([
      { properties: { attempt_id: input.attemptId, level: "C2", test: "level_test_out" } },
    ]);

    expect(events.filter((event) => event.name === "Test Answered")).toHaveLength(8);

    expect(events.filter((event) => event.name === "Test Finished")).toMatchObject([
      { properties: { answered: 8, end: "check_passed", lessons_skipped: 2, levels_skipped: 1 } },
    ]);

    expect(events.filter((event) => event.name === "Test Result Undone")).toMatchObject([
      { properties: { attempt_id: input.attemptId, change_id: changeId, lessons_restored: 2 } },
    ]);

    await expect(finishLanguageLevelTestOut(input)).resolves.toMatchObject({
      test: { result: { changeId: null, lessonsSkipped: 0, topicsSkipped: [] } },
    });
  });
});

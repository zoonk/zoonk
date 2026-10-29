import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { holdBackLessonDraft } from "../library/generation/hold-back-lesson";
import {
  generatedMultipleChoice,
  generatedProvenance,
} from "../library/items/_test-utils/generated-items";
import { createItems } from "../library/items/create-items";
import { selectDayPlanFromContext } from "../sessions/_utils/selected-day-plan";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { commitPlan } from "./_utils/commit-plan";
import { loadPlanContext } from "./_utils/plan-context";
import { readFreshPlanSummary } from "./_utils/plan-summary";
import { computePlan } from "./_utils/replan";
import { readSelectedItemFacts } from "./_utils/selected-item-contract";
import { createGoalPlan } from "./create-goal-plan";
import { PlanConflictError, withPlanRetry } from "./plan-conflict";

const NOW = new Date("2020-09-28T12:00:00Z");

async function readSaved(planId: string) {
  return prisma.plan.findUniqueOrThrow({
    include: { changes: true, goal: true, items: { orderBy: { position: "asc" } } },
    where: { id: planId },
  });
}

async function setup() {
  const [user, library] = await Promise.all([
    userFixture(),
    planLibraryFixture({ skills: [{ lessons: 1 }, { lessons: 1 }] }),
  ]);

  await prisma.lesson.update({
    data: { estimatedMinutes: 40 },
    where: { id: library.lessons[0]!.id },
  });

  const { goal, plan } = await unplannedGoalFixture({
    createdAt: NOW,
    dailyMinutes: 10,
    details: { placementDeclined: true },
    settings: { startDate: "2020-09-28" },
    targetDate: new Date("2020-10-20"),
    timezone: "UTC",
    userId: user.id,
  });

  mockSession(user.id);

  await expect(
    createGoalPlan({ goalId: goal.id, graph: library.graph, setup: "steps" }),
  ).resolves.toMatchObject({ status: "created" });

  const currentGoal = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
  const context = await loadPlanContext({ goal: currentGoal, now: NOW });

  if (!context) {
    throw new Error("Expected the actual saved plan context");
  }

  return { context, library, plan, user };
}

describe("selected plan persistence", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("saves one selected summary and every item's real workload in the creation transaction", async () => {
    const { library, plan, user } = await setup();
    const saved = await readSaved(plan.id);

    const summary = readFreshPlanSummary({
      basis: {
        layoutInputVersion: saved.inputVersion,
        layoutSourceVersion: saved.sourceVersion,
        layoutStudyDay: "2020-09-28",
        planId: saved.id,
        planVersion: saved.version,
        timeZone: "UTC",
        userId: user.id,
      },
      value: saved.summary,
    });

    expect(summary).not.toBeNull();

    expect(saved.sourceSkillIds).toStrictEqual(
      expect.arrayContaining(library.skills.map(({ id }) => id)),
    );

    expect(summary?.selected?.totalMinutes).toBe(saved.estimateHours! * 60);

    const longLesson = saved.items.find((item) => item.lessonId === library.lessons[0]!.id);
    const facts = readSelectedItemFacts(longLesson?.facts);

    expect(facts?.minutes).toBe(longLesson?.minutes);
    expect(facts?.minutes).toBeGreaterThan(40);
    expect(facts?.days?.length).toBeGreaterThan(1);
    expect(facts?.teachingEnd).toBe(facts?.days?.at(-1)?.[0]);

    for (const item of saved.items) {
      const itemFacts = readSelectedItemFacts(item.facts);
      expect(itemFacts).not.toBeNull();
      expect(itemFacts?.minutes).toBe(item.minutes);

      expect(Object.values(itemFacts?.parts ?? {}).reduce((sum, minutes) => sum + minutes, 0)).toBe(
        item.minutes,
      );
    }
  });

  it("commits across a content publication, then reselects Today from the newer source", async () => {
    const { context, library, plan } = await setup();
    const computed = await computePlan({ context, mode: "automatic", now: NOW });

    const questions = await createItems({
      format: "multipleChoice",
      items: Array.from({ length: 6 }, () => generatedMultipleChoice()),
      language: "en",
      provenance: generatedProvenance(),
      skillId: library.skills[0]!.id,
    });

    expect(questions.created).toHaveLength(6);
    await expect(commitPlan({ change: null, computed, context })).resolves.toBeNull();

    const saved = await readSaved(plan.id);

    expect(saved.summary).toMatchObject({
      basis: { layoutSourceVersion: context.plan.sourceVersion },
    });

    expect(saved.sourceVersion).toBeGreaterThan(context.plan.sourceVersion);
    const fresh = await loadPlanContext({ goal: saved.goal, now: NOW });
    expect(fresh).not.toBeNull();

    const today = await selectDayPlanFromContext({
      context: fresh!,
      now: NOW,
      useFreshSaved: true,
    });

    expect(today.computed ?? today.retained).toBeDefined();
    const selected = today.computed ?? today.retained;

    expect([...selected!.itemFacts.values()].some((facts) => facts.boss?.questions === 6)).toBe(
      true,
    );
  });

  it("rejects a hold-back during computation and retries once across a publication", async () => {
    const { context, library, plan, user } = await setup();
    const lesson = library.lessons[0]!;
    const runId = randomUUID();

    await prisma.lesson.update({
      data: { contentRunId: runId, contentStatus: "running", ownerId: user.id },
      where: { id: lesson.id },
    });

    await prisma.planItem.deleteMany({ where: { lessonId: lesson.id, planId: plan.id } });

    let attempts = 0;
    const held: unknown[] = [];
    const conflicts: unknown[] = [];
    const heldVersions: number[] = [];
    const selectedBeforeHold: (string | null)[] = [];
    const publications: number[] = [];

    const saving = withPlanRetry(async () => {
      attempts += 1;
      const current = await loadPlanContext({ goal: context.goal, now: NOW });
      expect(current).not.toBeNull();
      const computed = await computePlan({ context: current!, mode: "automatic", now: NOW });

      if (attempts === 1) {
        selectedBeforeHold.push(...computed.built.items.map((item) => item.lessonId));

        held.push(
          await holdBackLessonDraft({
            lessonId: lesson.id,
            model: "test",
            problems: [{ problem: "The lesson cannot be played", screen: null }],
            workflowRunId: runId,
          }),
        );

        const afterHold = await readSaved(plan.id);
        heldVersions.push(afterHold.version - current!.plan.version);
      } else {
        const published = await createItems({
          format: "multipleChoice",
          items: [generatedMultipleChoice()],
          language: "en",
          provenance: generatedProvenance(),
          skillId: library.skills[1]!.id,
        });

        publications.push(published.created.length);
      }

      return commitPlan({ change: null, computed, context: current! }).catch((error: unknown) => {
        conflicts.push(error);
        throw error;
      });
    });

    await expect(saving).resolves.toBeNull();
    expect(attempts).toBe(2);
    expect(publications).toStrictEqual([1]);
    expect(held).toMatchObject([{ setAside: true }]);
    expect(heldVersions).toStrictEqual([0]);
    expect(selectedBeforeHold).toContain(lesson.id);
    expect(conflicts).toStrictEqual([expect.any(PlanConflictError)]);
    const saved = await readSaved(plan.id);

    expect(
      saved.items.filter((item) => item.status === "todo").map((item) => item.lessonId),
    ).not.toContain(lesson.id);
  });

  it("recomputes the selected boss against a newly populated bank", async () => {
    const { context, library } = await setup();
    const boss = context.items.find((item) => item.kind === "boss");
    expect(boss).toBeDefined();
    expect(readSelectedItemFacts(boss?.facts)?.boss).toMatchObject({ minutes: 15 });

    await createItems({
      format: "multipleChoice",
      items: Array.from({ length: 6 }, () => generatedMultipleChoice()),
      language: "en",
      provenance: generatedProvenance(),
      skillId: library.skills[0]!.id,
    });

    const fresh = await loadPlanContext({ goal: context.goal, now: NOW });

    if (!fresh) {
      throw new Error("Expected the fresh owned context");
    }

    const computed = await computePlan({ context: fresh, mode: "automatic", now: NOW });
    const size = computed.itemFacts.get(`boss:${boss!.phase}`)?.boss;

    expect(size).toMatchObject({ minutes: 9, questions: 6, waiting: false });
    expect(computed.built.items.find((item) => item.kind === "boss")?.minutes).toBe(9);
  });

  it("rolls back the summary and item facts with a failed final transaction write", async () => {
    const { context, plan } = await setup();
    const before = await readSaved(plan.id);

    const computed = await computePlan({
      context,
      mode: "forced",
      now: NOW,
      state: { ...context.state, goal: { ...context.state.goal, dailyMinutes: 20 } },
    });

    await expect(
      commitPlan({
        change: null,
        computed,
        context,
        extraWrites: (tx) =>
          tx.planItem.create({
            data: {
              kind: "lesson",
              lessonId: randomUUID(),
              phase: 0,
              planId: plan.id,
              position: 1000,
              titleSnapshot: "Unavailable lesson",
            },
          }),
      }),
    ).rejects.toMatchObject({ code: "P2003" });

    await expect(readSaved(plan.id)).resolves.toStrictEqual(before);
  });
});

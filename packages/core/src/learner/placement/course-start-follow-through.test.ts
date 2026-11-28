import { prisma } from "@zoonk/db";
import { layOutPlanFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { pickItemInBlock } from "../../_test-utils/shown-choice";
import {
  UNIT_PLAN_SELECT,
  loadCertificateUnits,
} from "../../certificates/_utils/load-certificate-units";
import { loadSkillPrerequisites } from "../../library/skills/skill-prerequisites";
import { finishChallengesFixture } from "../../plans/_test-utils/finish-challenges";
import { decidePlanChange } from "../../plans/decide-plan-change";
import { getGoalPlan } from "../../plans/get-goal-plan";
import { parsePlanGraph } from "../../plans/planner/plan-state";
import { refreshTestedOutPlan } from "../../plans/refresh-tested-out-plan";
import { dueSkillFixture } from "../../sessions/_test-utils/session-goal";
import { planSignals } from "../../sessions/_utils/living-plan-session";
import { completeLessonPlanItems } from "../../sessions/_utils/plan-items";
import { loadPracticeClaims } from "../../sessions/_utils/practice-claims";
import { answerStudyQuestion } from "../../sessions/answer-study-question";
import { readBlockPayload } from "../../sessions/block-payload";
import { openStudyDay } from "../../sessions/open-study-day";
import { startStudyBlock } from "../../sessions/start-study-block";
import { coursePlacementSitting } from "../_test-utils/course-placement-sitting";
import { learnerGoalFixture } from "../_test-utils/learner-goal";
import { loadPlacementPlan } from "../_utils/goal-skill-graph";
import { loadClaimEvents } from "../_utils/load-skill-claims";
import { listKnownSkills } from "../_utils/skill-claims";
import { finishGoalPlacement } from "./finish-goal-placement";
import { getGoalPlacement } from "./get-goal-placement";

async function setup(phases = [5]) {
  const user = await userFixture();
  const fixture = await learnerGoalFixture({ itemsPerSkill: 0, phases, userId: user.id });
  mockSession(user.id);
  const goalId = fixture.goal.id;

  let bank: Awaited<ReturnType<typeof coursePlacementSitting>>["bank"] = [];

  const finish = async () => {
    const sitting = await coursePlacementSitting(
      goalId,
      fixture.skills.map((skill) => skill.id),
      bank,
    );

    bank = sitting.bank;
    await sitting.answerAll();
    return finishGoalPlacement({ goalId, input: { attemptId: sitting.attemptId } });
  };

  return { ...fixture, finish, goalId, user };
}

async function prepareCoursePractice(dailyMinutes: number) {
  const { finish, goalId, plan, skills, user } = await setup();
  await finish();
  const studied = skills[4]!.id;
  const needed = skills[3]!.id;
  await layOutPlanFixture(plan.id);
  await finishChallengesFixture(plan.id);
  await prisma.goal.update({ data: { dailyMinutes, timezone: "UTC" }, where: { id: goalId } });
  await dueSkillFixture({ skillId: studied, userId: user.id });

  await Promise.all(
    skills.flatMap(({ id }) => Array.from({ length: 4 }, () => itemFixture({ skillId: id }))),
  );

  const first = new Date();
  first.setUTCDate(first.getUTCDate() + ((3 - first.getUTCDay() + 7) % 7));

  const practice = async (week: number) => {
    const now = new Date(first.getTime() + week * 7 * 86_400_000);
    const shownDate = now.toISOString().slice(0, 10);
    const opened = await openStudyDay({ goalId, shownDate, timeZone: "UTC" }, now);

    if (opened.status !== "opened") {
      throw new Error(`Expected the study day to open, received ${opened.status}`);
    }

    const blocks = await prisma.studySessionBlock.findMany({
      where: { kind: "practice", sessionId: opened.sessionId },
    });

    expect(opened.session.minutes.planned).toBeLessThanOrEqual(dailyMinutes);
    expect(blocks).toHaveLength(1);
    return readBlockPayload(blocks[0]!);
  };

  return { goalId, needed, practice, skills, studied };
}

describe("course placement after completion", () => {
  it.each([0, 1])(
    "keeps the saved stops through a start and Undo with %i graph phases",
    async (count) => {
      const { finish, goalId, plan, planItems, user } = await setup([3, 2]);
      const layout = await layOutPlanFixture(plan.id);
      const { phases, ...graph } = parsePlanGraph(layout.plan.graph);

      await prisma.plan.update({
        data: { graph: count ? { ...graph, phases: phases.slice(0, count) } : graph },
        where: { id: plan.id },
      });

      const items = () =>
        prisma.planItem.findMany({
          orderBy: { position: "asc" },
          select: { id: true, phase: true, status: true },
          where: { planId: plan.id },
        });

      const before = await items();
      const finished = await finish();

      if (finished.status !== "ready" || !finished.completion.changeId) {
        throw new Error("Expected an applied start");
      }

      const stops = phases.map(({ name }) => ({ name }));

      const result = {
        chapter: phases[1]!.name,
        course: {
          chapters: [
            { lessons: 3, skipped: 3, start: false },
            { lessons: 2, skipped: 1, start: true },
          ],
          lessons: 5,
        },
        nextLesson: { id: planItems[4]!.lessonId },
      };

      expect(finished.completion.result).toMatchObject(result);
      await refreshTestedOutPlan({ goalId, userId: user.id });

      await expect(getGoalPlan(goalId)).resolves.toMatchObject({
        plan: { currentPhase: 1, phases: stops },
      });

      await expect(getGoalPlacement({ goalId })).resolves.toMatchObject({ placement: { result } });

      const after = await items();

      for (const item of planItems) {
        expect(after).toContainEqual(expect.objectContaining({ id: item.id, phase: item.phase }));
      }

      await decidePlanChange({
        changeId: finished.completion.changeId,
        goalId,
        input: { status: "undone" },
      });

      await expect(items()).resolves.toStrictEqual(before);

      await expect(getGoalPlan(goalId)).resolves.toMatchObject({
        plan: { currentPhase: 0, phases: stops },
      });
    },
  );

  it("returns the lessons on the first practice miss", async () => {
    const { finish, goalId, plan, planItems, skills, user } = await setup([2, 3]);
    const { bosses } = await layOutPlanFixture(plan.id);

    const checkpoint = () => prisma.planItem.findUniqueOrThrow({ where: { id: bosses[0]!.id } });
    await finish();
    await expect(checkpoint()).resolves.toMatchObject({ status: "testedOut" });

    await prisma.plan.update({
      data: { graph: { skills: parsePlanGraph(plan.graph).skills } },
      where: { id: plan.id },
    });

    const skillId = skills[0]!.id;
    const where = { kind: "lesson" as const, planId: plan.id, skillId };

    await expect(prisma.planItem.findFirstOrThrow({ where })).resolves.toMatchObject({
      status: "testedOut",
    });

    const item = await itemFixture({ content: choiceItemContent(), skillId });
    const session = await studySessionFixture({ goalId, userId: user.id });

    const block = await studySessionBlockFixture({
      kind: "practice",
      payload: { itemIds: [item.id], skillIds: [skillId] },
      sessionId: session.id,
    });

    await startStudyBlock({ blockId: block.id, input: {}, sessionId: session.id });

    await answerStudyQuestion({
      blockId: block.id,
      input: { answer: { dontKnow: true }, durationMs: 4000, itemId: item.id },
      sessionId: session.id,
    });

    await expect(prisma.planItem.findFirstOrThrow({ where })).resolves.toMatchObject({
      status: "todo",
    });

    await expect(checkpoint()).resolves.toMatchObject({ status: "todo" });

    await expect(getGoalPlacement({ goalId })).resolves.toMatchObject({
      placement: {
        result: {
          course: {
            chapters: [
              { skipped: 1, start: true },
              { skipped: 2, start: false },
            ],
          },
          lessonsSkipped: 3,
          nextLesson: { id: planItems[0]!.lessonId },
        },
      },
    });
  });

  it("starts after lessons filed under a topic that teach finer Library skills", async () => {
    const { finish, planItems, skills } = await setup();
    const finer = await skillFixture();

    await prisma.lessonSkill.updateMany({
      data: { skillId: finer.id },
      where: { lessonId: planItems[0]!.lessonId!, skillId: skills[0]!.id },
    });

    const finished = await finish();

    expect(finished).toMatchObject({
      completion: {
        lessonsSkipped: 4,
        result: {
          course: { chapters: [{ skipped: 4, start: true }], lessons: 5 },
          nextLesson: { id: planItems[4]!.lessonId },
        },
      },
    });
  });

  it("separates completed lessons from this start when finishing and reopening the result", async () => {
    const { finish, goalId, plan, planItems, user } = await setup([2, 5]);
    const { bosses } = await layOutPlanFixture(plan.id);

    await prisma.planItem.update({
      data: { chapterId: planItems[0]!.chapterId },
      where: { id: planItems[2]!.id },
    });

    const study = (index: number) =>
      prisma.$transaction((tx) =>
        completeLessonPlanItems(tx, {
          lessonId: planItems[index]!.lessonId!,
          now: new Date(),
          userId: user.id,
        }),
      );

    await study(0);

    await prisma.planItem.update({
      data: { completedAt: new Date(), status: "testedOut" },
      where: { id: planItems[1]!.id },
    });

    const firstChapter = { done: 2, lessons: 2, skipped: 0, start: false };

    const result = (done: number, skipped: number) => ({
      chapter: "Phase 2",
      course: { chapters: [firstChapter, { done, lessons: 5, skipped, start: true }], lessons: 7 },
      lessonsSkipped: skipped,
      nextLesson: { id: planItems[6]!.lessonId },
    });

    await expect(finish()).resolves.toMatchObject({
      completion: { lessonsSkipped: 4, result: result(0, 4) },
    });

    await expect(getGoalPlacement({ goalId })).resolves.toMatchObject({
      placement: { result: result(0, 4) },
    });

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: bosses[0]!.id } }),
    ).resolves.toMatchObject({ status: "testedOut" });

    await study(2);

    await expect(getGoalPlacement({ goalId })).resolves.toMatchObject({
      placement: { result: result(1, 3) },
    });
  });

  it("keeps earlier skipped items provisional after a second test", async () => {
    const { chapters, finish, goalId, plan, skills, user } = await setup();
    const first = skills[0]!.id;
    const last = skills[4]!.id;
    const chapterId = chapters[0]!.id;
    const lesson = await libraryLessonFixture({ homeChapterId: chapterId });
    await lessonSkillFixture({ lessonId: lesson.id, skillId: last });

    await planItemFixture({
      chapterId,
      lessonId: lesson.id,
      planId: plan.id,
      position: 5,
      skillId: first,
    });

    await finish();

    const known = async () =>
      listKnownSkills({
        events: await loadClaimEvents({ goalId, skillIds: [first], userId: user.id }),
      });

    const before = await known();
    expect(before.has(first)).toBe(false);
    await finish();
    const after = await known();
    expect(after.has(first)).toBe(false);
  });

  it("withholds credit after one right practice answer and releases it after studying the lesson", async () => {
    const { finish, goal, goalId, plan, planItems, skills, user } = await setup();
    await finish();
    const skillId = skills[0]!.id;

    await prisma.planItem.updateMany({
      data: { completedAt: new Date(), status: "done" },
      where: { planId: plan.id, skillId: { not: skillId } },
    });

    const units = async () => {
      const saved = await prisma.plan.findUniqueOrThrow({
        select: UNIT_PLAN_SELECT,
        where: { id: plan.id },
      });

      return loadCertificateUnits({ goal, plan: saved });
    };

    const item = await itemFixture({ content: choiceItemContent(), skillId });
    const session = await studySessionFixture({ goalId, userId: user.id });

    const block = await studySessionBlockFixture({
      kind: "practice",
      payload: { itemIds: [item.id], skillIds: [skillId] },
      sessionId: session.id,
    });

    await startStudyBlock({ blockId: block.id, input: {}, sessionId: session.id });
    const answer = await pickItemInBlock({ blockId: block.id, itemId: item.id });

    await answerStudyQuestion({
      blockId: block.id,
      input: { answer, durationMs: 4000, itemId: item.id },
      sessionId: session.id,
    });

    await expect(
      prisma.attempt.findFirstOrThrow({ where: { itemId: item.id, userId: user.id } }),
    ).resolves.toMatchObject({ isCorrect: true });

    const afterAnswer = await units();
    expect(afterAnswer.units.some((unit) => !unit.finished)).toBe(true);

    await prisma.$transaction((tx) =>
      completeLessonPlanItems(tx, {
        lessonId: planItems[0]!.lessonId!,
        now: new Date(),
        userId: user.id,
      }),
    );

    const afterStudy = await units();
    expect(afterStudy.units.every((unit) => unit.finished)).toBe(true);
  });

  it("builds practice from the next prerequisites and rotates unasked starts across sessions", async () => {
    const { goalId, needed, practice, skills, studied } = await prepareCoursePractice(9);

    const signals = planSignals({
      plan: await loadPlacementPlan(goalId),
      prerequisites: await loadSkillPrerequisites(skills.map((skill) => skill.id)),
      windows: [
        { at: new Date().toISOString(), missedSkillIds: [studied], result: "hard", streak: 1 },
      ],
    });

    expect(signals.hardRecheckSkillIds).toStrictEqual([needed]);
    const seen = new Set<string>();

    const takeWeek = async (week: number) => {
      const payload = await practice(week);
      expect(payload.itemIds).toHaveLength(2);
      expect(payload.skillIds).toContain(studied);
      const skipped = payload.skillIds.find((id) => id !== studied)!;
      expect(seen.has(skipped)).toBe(false);
      seen.add(skipped);
    };

    await takeWeek(0);
    await takeWeek(1);
    expect(seen.has(needed)).toBe(true);
    await takeWeek(2);
    await takeWeek(3);
    expect(seen.size).toBe(4);
  });

  it.each([true, false])(
    "opens a single practice question when the next lesson needs a started-past topic: %s",
    async (requiresStart) => {
      const { needed, practice, studied } = await prepareCoursePractice(8);

      if (!requiresStart) {
        await prisma.skillPrerequisite.deleteMany({ where: { skillId: studied } });
      }

      const payload = await practice(0);
      expect(payload.itemIds).toHaveLength(1);
      expect(payload.skillIds).toStrictEqual([requiresStart ? needed : studied]);
    },
  );

  it("bounds practice history after an old start is studied", async () => {
    const { finish, goal, goalId, plan, planItems, skills, user } = await setup();
    await finish();
    const old = new Date(Date.now() - 180 * 86_400_000);
    const studied = skills.at(-1)!.id;

    await prisma.planChange.create({
      data: {
        createdAt: old,
        kind: "testedOut",
        payload: { startedPastSkillIds: [studied] },
        planId: plan.id,
        reason: "Earlier start",
        status: "applied",
      },
    });

    await prisma.planItem.update({
      data: { completedAt: new Date(), status: "done" },
      where: { id: planItems.at(-1)!.id },
    });

    const previous = await studySessionFixture({ goalId, localDate: old, userId: user.id });

    await studySessionBlockFixture({
      kind: "practice",
      payload: { skillIds: [studied] },
      sessionId: previous.id,
    });

    const claims = await loadPracticeClaims({
      goal,
      graph: parsePlanGraph(plan.graph),
      now: new Date(),
      skillIds: skills.map((skill) => skill.id),
      today: new Date(),
      userId: user.id,
    });

    expect(claims.courseStarts?.length).toBeGreaterThan(0);
    expect(claims.lastAsked.has(studied)).toBe(false);
  });
});

import { type Skill, prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { skillPrerequisiteFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { reportExamResult } from "../exams/results/report-exam-result";
import { requestLessonGeneration } from "../lookahead/request-lesson-generation";
import { getGoalPreparation } from "../preparation/get-goal-preparation";
import { answerOnboardingQuestion } from "../view-models/onboarding/answer-onboarding-question";
import { getSyllabusView } from "../view-models/syllabus/get-syllabus-view";
import { TOPICS, day, enemBiologyGoal, isoDay, setClock } from "./_test-utils/enem-biology";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { getPlanBasesAdvice } from "./get-bases-advice";
import { getGoalPlan } from "./get-goal-plan";
import { type PlanOperation } from "./plan-contract";
import { previewPlanChange } from "./preview-plan-change";

/** Lucas's ENEM goal with its plan built (see `enemBiologyGoal`). */
async function setup(options: Parameters<typeof enemBiologyGoal>[0]) {
  const built = await enemBiologyGoal(options);

  mockSession(built.user.id);
  await createGoalPlan({ goalId: built.goal.id, graph: built.graph });

  return built;
}

async function readPlan(goalId: string) {
  const result = await getGoalPlan(goalId);

  if (result.status !== "ready") {
    throw new Error(`Expected the plan, got ${result.status}`);
  }

  return result.plan;
}

/**
 * What the app recommends for the plan's bases, when the learner asks ("Get a recommendation"): it
 * plans the goal with every base in depth, so no read of the plan says it.
 */
async function readBasesAdvice(goalId: string) {
  const result = await getPlanBasesAdvice(goalId);

  if (result.status !== "ready") {
    throw new Error(`Expected the bases advice, got ${result.status}`);
  }

  return result.advice;
}

async function change(goalId: string, operations: PlanOperation[]) {
  return changeGoalPlan({ goalId, input: { operations: operations as never, timeZone: "UTC" } });
}

/** The base's quick lesson ("Quick lesson"), when the Library has one. */
async function findQuickLesson(skillId: string) {
  return prisma.lesson.findFirst({
    select: { contentStatus: true, id: true },
    where: { identityKey: { endsWith: `quick:${skillId}` } },
  });
}

async function lessonItems({ planId, skillId }: { planId: string; skillId: string }) {
  return prisma.planItem.findMany({
    orderBy: { position: "asc" },
    where: { kind: "lesson", planId, skillId },
  });
}

describe("bases a learner chooses how to study", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    setClock(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts a new plan close to its exam on the recommendation: a quick lesson for each base", async () => {
    const { ecology, goal, library, living, plan } = await setup({ days: 30 });

    const [viewed, livingItems, ecologyItems] = await Promise.all([
      readPlan(goal.id),
      lessonItems({ planId: plan.id, skillId: living.id }),
      lessonItems({ planId: plan.id, skillId: ecology.id }),
    ]);

    expect(viewed.bases).toMatchObject({
      daysLeft: 30,
      items: [{ choice: "quick", neededFor: ["Ecologia"], skillId: living.id }],
      knownCount: 0,
    });

    expect(viewed.bases).not.toHaveProperty("recommended");

    await expect(readBasesAdvice(goal.id)).resolves.toStrictEqual({
      daysLeft: 30,
      ready: true,
      recommended: "quick",
    });

    const [base] = viewed.bases?.items ?? [];
    const { deep = 0, essential = 0, quick = 0 } = base?.minutes ?? {};
    const quickLesson = await findQuickLesson(living.id);

    expect(deep).toBeGreaterThan(essential);
    expect(essential).toBeGreaterThan(quick);

    // One lesson: the base's quick lesson, never one of its own, nothing written before it's needed.
    expect(livingItems.map((item) => item.lessonId)).toStrictEqual([quickLesson?.id]);
    expect(library.lessons.some((lesson) => lesson.id === quickLesson?.id)).toBe(false);
    expect(quickLesson?.contentStatus).toBe("pending");
    expect(ecologyItems.length).toBeGreaterThan(0);

    // Opening it gets it written, like any planned lesson.
    await expect(
      requestLessonGeneration({ lessonId: quickLesson?.id ?? "" }),
    ).resolves.toMatchObject({ lessonId: quickLesson?.id, status: "start" });
  });

  it("previews a quick lesson without writing anything, and saving the choice plans the base's quick lesson", async () => {
    const { goal, living, plan } = await setup({ dailyMinutes: 5, days: 90 });
    const quickChoice = [{ choice: "quick" as const, skillId: living.id }];

    const preview = await previewPlanChange({
      goalId: goal.id,
      input: { operations: [{ choices: quickChoice, kind: "setBaseChoices" }], timeZone: "UTC" },
    });

    expect(preview).toMatchObject({ preview: { ready: true, unchanged: false }, status: "ready" });
    await expect(findQuickLesson(living.id)).resolves.toBeNull();

    await change(goal.id, [{ choices: quickChoice, kind: "setBaseChoices" }]);

    const [quickLesson, livingItems] = await Promise.all([
      findQuickLesson(living.id),
      lessonItems({ planId: plan.id, skillId: living.id }),
    ]);

    expect(livingItems.map((item) => item.lessonId)).toStrictEqual([quickLesson?.id]);
  });

  it("starts a new plan far from its exam, with too little time for everything, with each base's core", async () => {
    const { goal, living, plan } = await setup({ dailyMinutes: 5, days: 90 });
    const viewed = await readPlan(goal.id);
    const livingItems = await lessonItems({ planId: plan.id, skillId: living.id });

    expect(viewed.bases).toMatchObject({ daysLeft: 90, items: [{ choice: "essential" }] });

    await expect(readBasesAdvice(goal.id)).resolves.toMatchObject({
      daysLeft: 90,
      recommended: "essential",
    });

    expect(livingItems.length).toBeGreaterThan(1);
  });

  it("starts a new plan whose time covers everything with each base in depth", async () => {
    const { goal, living, plan } = await setup({ dailyMinutes: 240, days: 200 });
    const viewed = await readPlan(goal.id);
    const livingItems = await lessonItems({ planId: plan.id, skillId: living.id });
    const lessons = livingItems.reduce((total, item) => total + (item.lessonId ? 1 : 0), 0);

    expect(viewed.bases).toMatchObject({ items: [{ choice: "deep" }] });
    await expect(readBasesAdvice(goal.id)).resolves.toMatchObject({ recommended: "deep" });
    expect(lessons).toBe(3);
    expect(viewed.feasibility?.fits).toBe(true);
  });

  it("previews a choice with nothing saved, then keeps the learner's: the recommendation is only shown", async () => {
    const { goal, living, plan } = await setup({ days: 30 });
    const before = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    const learnFirst = [{ choice: "essential" as const, skillId: living.id }];

    const preview = await previewPlanChange({
      goalId: goal.id,
      input: { operations: [{ choices: learnFirst, kind: "setBaseChoices" }], timeZone: "UTC" },
    });

    expect(preview).toMatchObject({ preview: { ready: true, unchanged: false }, status: "ready" });

    const effect = preview.status === "ready" ? preview.preview.effect : null;
    expect(effect?.lessonsAdded).toBeGreaterThan(0);

    const after = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(after.version).toBe(before.version);

    await expect(
      change(goal.id, [{ choices: learnFirst, kind: "setBaseChoices" }]),
    ).resolves.toMatchObject({ status: "applied" });

    const [livingItems, viewed] = await Promise.all([
      lessonItems({ planId: plan.id, skillId: living.id }),
      readPlan(goal.id),
    ]);

    expect(livingItems.length).toBeGreaterThan(1);

    expect(viewed.bases).toMatchObject({ items: [{ choice: "essential", skillId: living.id }] });
    await expect(readBasesAdvice(goal.id)).resolves.toMatchObject({ recommended: "quick" });
  });

  it("takes a skipped base out of the plan and says why its topic isn't in it", async () => {
    const { ecology, goal, living, plan } = await setup({ days: 30 });

    const preview = await previewPlanChange({
      goalId: goal.id,
      input: {
        operations: [{ choices: [{ choice: "skip", skillId: living.id }], kind: "setBaseChoices" }],
        timeZone: "UTC",
      },
    });

    expect(preview.status === "ready" && preview.preview.effect?.topicsLeftOut).toStrictEqual([
      { area: "Biologia", topics: ["Seres vivos"] },
    ]);

    await change(goal.id, [
      { choices: [{ choice: "skip", skillId: living.id }], kind: "setBaseChoices" },
    ]);

    const [livingItems, ecologyItems, syllabus] = await Promise.all([
      lessonItems({ planId: plan.id, skillId: living.id }),
      lessonItems({ planId: plan.id, skillId: ecology.id }),
      getSyllabusView({ goalId: goal.id }),
    ]);

    expect(livingItems).toStrictEqual([]);
    expect(ecologyItems.length).toBeGreaterThan(0);

    const topics = syllabus.status === "ready" ? syllabus.syllabus.subjects[0]?.topics : [];
    const topic = topics?.find((entry) => entry.name === "Seres vivos");

    expect(topic).toMatchObject({ notPlannedReason: "skippedBase", status: "notPlanned" });

    await change(goal.id, [
      { choices: [{ choice: "essential", skillId: living.id }], kind: "setBaseChoices" },
    ]);

    const learned = await lessonItems({ planId: plan.id, skillId: living.id });
    expect(learned.length).toBeGreaterThan(1);
  });

  it("leaves the plan as it is when the learner chooses for a base whose core they studied", async () => {
    const { goal, living, plan } = await setup({ days: 30, size: 3 });
    const learnFirst = [{ choice: "essential" as const, skillId: living.id }];
    const quickChoice = [{ choice: "quick" as const, skillId: living.id }];

    await change(goal.id, [{ choices: learnFirst, kind: "setBaseChoices" }]);

    const core = await lessonItems({ planId: plan.id, skillId: living.id });

    await prisma.planItem.updateMany({
      data: { completedAt: day(0), status: "done" },
      where: { id: { in: core.map((item) => item.id) } },
    });

    const before = await prisma.plan.findUniqueOrThrow({
      include: { items: { orderBy: { position: "asc" } } },
      where: { id: plan.id },
    });

    const preview = await previewPlanChange({
      goalId: goal.id,
      input: { operations: [{ choices: quickChoice, kind: "setBaseChoices" }], timeZone: "UTC" },
    });

    expect(preview).toMatchObject({ preview: { ready: true, unchanged: true }, status: "ready" });

    await expect(
      change(goal.id, [{ choices: quickChoice, kind: "setBaseChoices" }]),
    ).resolves.toStrictEqual({ change: null, status: "applied" });

    const after = await prisma.plan.findUniqueOrThrow({
      include: { items: { orderBy: { position: "asc" } } },
      where: { id: plan.id },
    });

    expect(core.length).toBeGreaterThan(0);
    expect(after.version).toBe(before.version);
    expect(after.items).toStrictEqual(before.items);
    expect(after.settings).toMatchObject({ baseChoices: quickChoice });
  });

  // Lucas switched a base from its quick lesson to deep study and back, then to its core and back.
  // Picking the earlier option again undid the change before it: the preview had said a topic
  // comes in, and saving put back a plan without it.
  it("saves what the preview said, each time the learner switches a base and back", async () => {
    const { goal, library, living, plan } = await setup({ days: 30 });
    const topicOf = new Map(library.skills.map((skill, index) => [skill.id, TOPICS[index] ?? ""]));

    const listTopics = async () => {
      const items = await prisma.planItem.findMany({ where: { planId: plan.id } });
      const planned = items.filter((item) => item.status !== "skipped" && item.skillId);
      const topics = new Set(planned.map((item) => topicOf.get(item.skillId ?? "") ?? ""));
      return [...topics].toSorted((a, b) => a.localeCompare(b));
    };

    /** The preview of a choice for the base, what saving it answered, and the topics before and after. */
    const switchTo = async (choice: "deep" | "essential" | "quick") => {
      const operations: PlanOperation[] = [
        { choices: [{ choice, skillId: living.id }], kind: "setBaseChoices" },
      ];

      const before = await listTopics();

      const preview = await previewPlanChange({
        goalId: goal.id,
        input: { operations: operations as never, timeZone: "UTC" },
      });

      const saved = await change(goal.id, operations);
      const effect = preview.status === "ready" ? preview.preview.effect : null;
      const added = (effect?.topicsAdded ?? []).flatMap((area) => area.topics);
      const leftOut = new Set((effect?.topicsLeftOut ?? []).flatMap((area) => area.topics));
      const expected = [...before.filter((topic) => !leftOut.has(topic)), ...added];

      return {
        after: await listTopics(),
        effect,
        expected: expected.toSorted((a, b) => a.localeCompare(b)),
        saved,
      };
    };

    const deep = await switchTo("deep");
    expect(deep.saved).toMatchObject({ change: { effect: deep.effect, status: "applied" } });
    expect(deep.after).toStrictEqual(deep.expected);

    const quick = await switchTo("quick");
    expect(quick.saved).toMatchObject({ change: { effect: quick.effect, status: "applied" } });
    expect(quick.after).toStrictEqual(quick.expected);

    const core = await switchTo("essential");
    expect(core.saved).toMatchObject({ change: { effect: core.effect, status: "applied" } });
    expect(core.after).toStrictEqual(core.expected);

    const quickAgain = await switchTo("quick");

    expect(quickAgain.saved).toMatchObject({
      change: { effect: quickAgain.effect, status: "applied" },
    });

    expect(quickAgain.after).toStrictEqual(quickAgain.expected);
  });
});

describe("onboarding's last answer", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    setClock(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("settles the new plan: its bases follow the recommendation for the learner's time, and an exam can study everything", async () => {
    const { goal } = await setup({ days: 30 });

    await expect(
      answerOnboardingQuestion({
        goalId: goal.id,
        input: { dailyMinutes: 240, fullCourse: true, question: "schedule", timeZone: "UTC" },
      }),
    ).resolves.toStrictEqual({ status: "saved" });

    // Four hours a day cover everything by the exam: the bases are studied in depth.
    const viewed = await readPlan(goal.id);

    expect(viewed.bases).toMatchObject({ items: [{ choice: "deep" }] });
    await expect(readBasesAdvice(goal.id)).resolves.toMatchObject({ recommended: "deep" });
    expect(viewed.schedule.fullCourse).toBe(true);
  });

  it("keeps the learner's own choice for the bases", async () => {
    const { goal, living } = await setup({ days: 30 });

    await change(goal.id, [
      { choices: [{ choice: "skip", skillId: living.id }], kind: "setBaseChoices" },
    ]);

    await answerOnboardingQuestion({
      goalId: goal.id,
      input: { dailyMinutes: 240, question: "schedule", timeZone: "UTC" },
    });

    const viewed = await readPlan(goal.id);
    expect(viewed.bases?.items[0]).toMatchObject({ choice: "skip", skillId: living.id });
  });
});

describe("studying everything", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    setClock(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("goes on after the exam with what doesn't fit, keeping the exam's date", async () => {
    const { goal, plan } = await setup({ days: 30 });
    const before = await readPlan(goal.id);

    expect(before.feasibility).toMatchObject({ fits: false });
    // The plan doesn't work out when everything would end for a read: the switch says it.
    expect(before.feasibility).not.toHaveProperty("fullCourseEndDate");

    const switched = await change(goal.id, [{ fullCourse: true, kind: "setFullCourse" }]);
    expect(switched).toMatchObject({ status: "applied" });
    const endDate = switched.status === "applied" ? switched.change?.effect?.endDateAfter : null;
    expect(new Date(endDate ?? 0).getTime()).toBeGreaterThan(day(30).getTime());

    const [viewed, after] = await Promise.all([
      readPlan(goal.id),
      prisma.planItem.findMany({ where: { planId: plan.id, scheduledFor: { gt: day(30) } } }),
    ]);

    expect(viewed.schedule).toMatchObject({ fullCourse: true, targetDate: isoDay(30) });
    expect(viewed.feasibility).toMatchObject({ fits: false });
    expect(viewed.estimate.endDate).toBe(endDate);
    expect(viewed.phases.at(-1)).toMatchObject({ kind: "afterExam", startDate: isoDay(31) });
    // The rest of each subject's lessons comes after the exam: their time and days, and their
    // items once the Library outlines them; the weekly mocks go on there too, for the next sitting.
    expect(viewed.phases.at(-1)?.hours).toBeGreaterThan(0);
    expect(after.some((item) => item.kind === "mock")).toBe(true);
    expect(after.some((item) => item.kind === "review" || item.kind === "checkpoint")).toBe(false);

    await change(goal.id, [{ fullCourse: false, kind: "setFullCourse" }]);

    await expect(
      prisma.planItem.count({
        where: { kind: "lesson", planId: plan.id, scheduledFor: { gt: day(30) } },
      }),
    ).resolves.toBe(0);
  });

  // Missed days set aside work there was no time for by the exam. Studying everything goes on
  // after the exam, and a class test's organelles stayed set aside.
  it("brings back work missed days set aside, as the same item", async () => {
    const { goal, plan } = await setup({ days: 30 });

    const aside = await prisma.planItem.findFirstOrThrow({
      orderBy: { position: "asc" },
      where: { kind: "lesson", lessonId: { not: null }, planId: plan.id, status: "todo" },
    });

    await prisma.planItem.update({ data: { status: "skipped" }, where: { id: aside.id } });

    await expect(
      change(goal.id, [{ fullCourse: true, kind: "setFullCourse" }]),
    ).resolves.toMatchObject({ status: "applied" });

    const items = await prisma.planItem.findMany({
      where: { lessonId: aside.lessonId, planId: plan.id },
    });

    expect(items).toMatchObject([{ id: aside.id, status: "todo" }]);
  });

  it("keeps the learner's pace once they study everything after the exam", async () => {
    // Lucas M. accepted "Study everything" on pace and read "Needs adjusting" with no reason: the
    // lessons he chose to study after the exam aren't a plan that no longer fits.
    const { goal } = await setup({ days: 30 });
    const before = await readPlan(goal.id);

    expect(before.status).toStrictEqual({ kind: "onTrack" });

    await change(goal.id, [{ fullCourse: true, kind: "setFullCourse" }]);

    const [viewed, preparation] = await Promise.all([
      readPlan(goal.id),
      getGoalPreparation(goal.id),
    ]);

    expect(viewed.status).toStrictEqual({ kind: "onTrack" });

    expect(preparation).toMatchObject({
      preparation: { status: { kind: "onTrack" } },
      status: "ready",
    });
  });

  it("studies everything without a date for other goals, and only exams go on after their date", async () => {
    const user = await userFixture();
    const library = await planLibraryFixture({ skills: [{ lessons: 3, size: 40 }] });

    const goal = await goalFixture({
      dailyMinutes: 10,
      kind: "learn",
      targetDate: day(20),
      timezone: "UTC",
      userId: user.id,
    });

    await Promise.all([
      planFixture({ goalId: goal.id, phases: [] }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ]);

    mockSession(user.id);
    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    const dated = await readPlan(goal.id);
    expect(dated.feasibility).toMatchObject({ fits: false });

    await expect(
      change(goal.id, [{ fullCourse: true, kind: "setFullCourse" }]),
    ).resolves.toStrictEqual({ error: "notExam", status: "invalid" });

    const dropped = await change(goal.id, [{ kind: "setTargetDate", targetDate: null }]);
    const endDate = dropped.status === "applied" ? dropped.change?.effect?.endDateAfter : null;

    const open = await readPlan(goal.id);

    expect(open.schedule.targetDate).toBeNull();
    expect(open.feasibility?.deadline).toBeNull();
    // The change that drops the date says when everything ends: the plan's own end once it's off.
    expect(endDate).toBeTruthy();
    expect(open.estimate.endDate).toBe(endDate);
  });
});

/** The days of the plan's mocks still to take, from `from` on. */
async function listMockDays({ from, planId }: { from: Date; planId: string }) {
  const mocks = await prisma.planItem.findMany({
    orderBy: { scheduledFor: "asc" },
    where: { kind: "mock", planId, scheduledFor: { gte: from }, status: "todo" },
  });

  return mocks.flatMap((item) => item.scheduledFor?.toISOString().slice(0, 10) ?? []);
}

describe("the plan's mock days", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    setClock(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the next mock's day when the learner moves the exam's date", async () => {
    // Ana moved ENEM a week earlier and read Sunday's mock three weeks later, with no word why.
    const { goal, plan } = await setup({ days: 200 });

    setClock(4);
    const before = await listMockDays({ from: day(4), planId: plan.id });

    expect(before.length).toBeGreaterThan(1);

    await change(goal.id, [{ kind: "setTargetDate", targetDate: isoDay(193) }]);

    const after = await listMockDays({ from: day(4), planId: plan.id });

    expect(after.slice(0, 2)).toStrictEqual(before.slice(0, 2));
  });

  it("says when a new daily time moves the next mock", async () => {
    // Ana's mock is weeks apart at a few minutes a day; more time brings it closer, and the card
    // has to say so, or her next mock just moves.
    const { goal, plan } = await setup({ days: 200 });

    // Past the plan's first mock: the next one is weeks away.
    setClock(10);
    const [before] = await listMockDays({ from: day(10), planId: plan.id });

    const result = await change(goal.id, [{ kind: "setDailyMinutes", minutes: 240 }]);
    const [after] = await listMockDays({ from: day(10), planId: plan.id });

    expect(after).not.toBe(before);
    expect(result).toMatchObject({ change: { effect: { nextMock: { after, before } } } });
  });

  it("says when the mocks ahead fall, only as regular as their planned days are", async () => {
    // Ana's "Your plan" reads "Mock exams · Sundays" only when every mock ahead is on a Sunday.
    const { goal, plan } = await setup({ days: 200 });

    setClock(4);

    const [days, viewed] = await Promise.all([
      listMockDays({ from: day(4), planId: plan.id }),
      readPlan(goal.id),
    ]);

    const weekdays = new Set(days.map((date) => new Date(`${date}T00:00:00Z`).getUTCDay()));

    expect(days.length).toBeGreaterThan(1);

    expect(viewed.schedule.mocks).toMatchObject({
      count: days.length,
      nextDate: days[0],
      weekday: weekdays.size === 1 ? [...weekdays][0] : null,
    });
  });

  it("says nothing about the next mock when a change keeps its day", async () => {
    const { goal } = await setup({ days: 200 });

    setClock(4);

    const result = await change(goal.id, [{ kind: "setTargetDate", targetDate: isoDay(193) }]);

    expect(result).toMatchObject({ status: "applied" });
    expect(result.status === "applied" && result.change?.effect?.nextMock).toBeFalsy();
  });
});

describe("after an exam that the learner studies everything for", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    setClock(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("proposes the next sitting's date once the learner says how it went", async () => {
    const examDay = isoDay(30);
    const citation = { passage: "", sourceId: "notice" };

    const { goal, plan } = await setup({
      days: 30,
      edition: {
        citations: [],
        dates: [{ citation, date: examDay, kind: "exam", label: "Prova", startTime: null }],
        noticeUrl: null,
        questionCount: null,
        sourceHash: null,
        timeZone: null,
        year: 2026,
      },
    });

    await change(goal.id, [{ fullCourse: true, kind: "setFullCourse" }]);

    setClock(31);

    await expect(
      reportExamResult({
        goalId: goal.id,
        input: { maxScore: null, passed: null, scale: "irt", score: 640 },
      }),
    ).resolves.toMatchObject({ status: "reported" });

    const proposal = await prisma.planChange.findFirstOrThrow({
      where: { planId: plan.id, status: "proposed" },
    });

    const operations = (proposal.payload as { operations: { kind: string; targetDate?: string }[] })
      .operations;

    const [nextSitting] = operations;

    expect(nextSitting).toMatchObject({ estimated: true, kind: "setNoticeDate" });
    expect(nextSitting?.targetDate?.slice(0, 4)).toBe("2027");
  });
});

/**
 * A UX career whose first portfolio project builds on research, all at the beginner band (the
 * course is the path), and whose product project builds on metrics, which build on statistics
 * from an easier band.
 */
async function careerSetup({ level }: { level: "intermediate" | "none" }) {
  const user = await userFixture();

  const library = await planLibraryFixture({
    skills: [
      { area: "Métricas", lessons: 3, size: 30 },
      { area: "Pesquisa", lessons: 3, size: 30 },
      { area: "Portfólio", lessons: 3, size: 30 },
      { area: "Métricas", lessons: 3, size: 30 },
      { area: "Portfólio", lessons: 3, size: 30 },
    ],
  });

  const [statistics, research, portfolio, metrics, product] = library.skills as [
    Skill,
    Skill,
    Skill,
    Skill,
    Skill,
  ];

  const bands = [
    [statistics, "overview"],
    [research, "beginner"],
    [portfolio, "beginner"],
    [metrics, "intermediate"],
    [product, "intermediate"],
  ] as const;

  const { goal } = await unplannedGoalFixture({
    dailyMinutes: 15,
    details: { level, placementDeclined: true },
    kind: "learn",
    targetDate: day(60),
    timezone: "UTC",
    userId: user.id,
  });

  await Promise.all([
    ...bands.map(([skill, band]) =>
      prisma.skill.update({ data: { level: band }, where: { id: skill.id } }),
    ),
    skillPrerequisiteFixture({ prerequisiteId: research.id, skillId: portfolio.id }),
    skillPrerequisiteFixture({ prerequisiteId: statistics.id, skillId: metrics.id }),
    skillPrerequisiteFixture({ prerequisiteId: metrics.id, skillId: product.id }),
    skillPrerequisiteFixture({ prerequisiteId: portfolio.id, skillId: product.id }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  const outcomes = new Set([portfolio.id, product.id]);

  mockSession(user.id);

  await createGoalPlan({
    goalId: goal.id,
    graph: {
      ...library.graph,
      skills: library.graph.skills.map((skill) => ({
        ...skill,
        outcome: outcomes.has(skill.skillId),
      })),
    },
  });

  return { goal, research, statistics };
}

describe("a career goal's bases", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    setClock(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps a career change from zero on its course: only a foundation from an easier band is a base", async () => {
    const { goal, statistics } = await careerSetup({ level: "none" });
    const viewed = await readPlan(goal.id);

    expect(viewed.bases?.items.map((item) => item.skillId)).toStrictEqual([statistics.id]);
  });

  it("offers the skills below the level the learner said they have as bases", async () => {
    const { goal, research, statistics } = await careerSetup({ level: "intermediate" });
    const viewed = await readPlan(goal.id);

    expect(viewed.bases?.items.map((item) => item.skillId)).toStrictEqual([
      statistics.id,
      research.id,
    ]);
  });
});

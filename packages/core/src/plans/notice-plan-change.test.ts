import { prisma } from "@zoonk/db";
import { planChangeFixture } from "@zoonk/testing/fixtures/goals";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { listGoalChangeNotices } from "../library/sources/source-change-notices";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { readPlanScreen } from "./_test-utils/ahead-plan";
import { followNoticeReading, noticeWaitFixture } from "./_test-utils/notice-landing";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { seenQuote } from "./_test-utils/seen-quote";
import { loadTodayPlanChange } from "./_utils/today-plan-change";
import { acknowledgeTodayPlanChange } from "./acknowledge-today-plan-change";
import { applyNoticeGraph } from "./apply-notice-graph";
import { createGoalPlan } from "./create-goal-plan";
import { decidePlanChange } from "./decide-plan-change";
import { proposeNoticeChange } from "./notice-plan-change";
import { claimNoticeLanding, isNoticeLandingExpiredError } from "./notice-wait";
import { NOTICE_SOURCE } from "./plan-change-contract";
import { type PlanGraph, parsePlanGraph } from "./planner/plan-state";

/** A Monday in 2020, before the learning events other tests write. */
const NOW = new Date("2020-09-28T12:00:00Z");
const TODAY = "2020-09-28";

const citation = { passage: "", sourceId: "notice" };

const WAIT_RAN_OUT_MS = 10 * 60 * 1000;

function examBlueprint({ days, year }: { days: string[]; year: number }) {
  return examBlueprintFixture({
    edition: {
      check: null,
      citations: [],
      dates: days.map((date) => ({ citation, date, kind: "exam", label: "Exam", startTime: null })),
      noticeUrl: null,
      questionCount: null,
      sourceHash: null,
      timeZone: null,
      year,
    },
  });
}

async function plannedExam({
  days,
  graph,
  targetDate,
  year,
}: {
  days: string[];
  graph?: PlanGraph;
  targetDate: string | null;
  year: number;
}) {
  const [user, blueprint, library] = await Promise.all([
    userFixture(),
    examBlueprint({ days, year }),
    planLibraryFixture({ skills: [{ lessons: 1 }, { lessons: 1 }] }),
  ]);

  const { goal } = await unplannedGoalFixture({
    details: { examName: "Test Exam" },
    examBlueprintId: blueprint.id,
    kind: "exam",
    settings: { startDate: TODAY },
    targetDate: targetDate ? new Date(`${targetDate}T00:00:00Z`) : null,
    userId: user.id,
  });

  mockSession(user.id);
  await createGoalPlan({ goalId: goal.id, graph: graph ?? library.graph });

  return { blueprint, goal, library, user };
}

async function readTargetDate(goalId: string): Promise<string | null> {
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
  return goal.targetDate?.toISOString().slice(0, 10) ?? null;
}

function findProposals(goalId: string) {
  return prisma.planChange.findMany({ where: { plan: { goalId }, status: "proposed" } });
}

async function decide({
  changeId,
  goalId,
  status,
}: {
  changeId: string;
  goalId: string;
  status: "applied" | "declined";
}) {
  return decidePlanChange({
    changeId,
    goalId,
    input: { quote: await seenQuote(changeId), status, timeZone: "UTC" },
  });
}

describe(proposeNoticeChange, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);

    vi.mocked(getRequestProgressDateContext).mockResolvedValue({
      currentDate: new Date(`${TODAY}T00:00:00Z`),
      currentInstant: NOW,
      timeZone: "UTC",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("proposes the notice's exam day to a plan counting down to another, and moves it only on Apply", async () => {
    const { goal } = await plannedExam({
      days: ["2020-11-08"],
      targetDate: "2020-12-20",
      year: 2020,
    });

    await expect(proposeNoticeChange({ goalId: goal.id })).resolves.toBe("proposed");
    await expect(readTargetDate(goal.id)).resolves.toBe("2020-12-20");

    const [proposal] = await findProposals(goal.id);

    expect(proposal?.payload).toMatchObject({
      operations: [{ estimated: false, kind: "setNoticeDate", targetDate: "2020-11-08" }],
      source: "notice",
    });

    await expect(
      decide({ changeId: proposal?.id ?? "", goalId: goal.id, status: "applied" }),
    ).resolves.toMatchObject({ status: "updated" });

    await expect(readTargetDate(goal.id)).resolves.toBe("2020-11-08");
  });

  it("remembers Keep mine: the day the learner kept their date over isn't proposed again", async () => {
    const { goal } = await plannedExam({
      days: ["2020-11-08"],
      targetDate: "2020-12-20",
      year: 2020,
    });

    await proposeNoticeChange({ goalId: goal.id });
    const [proposal] = await findProposals(goal.id);

    await decide({ changeId: proposal?.id ?? "", goalId: goal.id, status: "declined" });

    await expect(proposeNoticeChange({ goalId: goal.id })).resolves.toBe("none");
    await expect(findProposals(goal.id)).resolves.toHaveLength(0);
    await expect(readTargetDate(goal.id)).resolves.toBe("2020-12-20");
  });

  it("never proposes an estimated day over the goal's date, nor a day it already has", async () => {
    const estimated = await plannedExam({
      days: ["2019-11-03"],
      targetDate: "2020-12-20",
      year: 2019,
    });

    const sameDay = await plannedExam({
      days: ["2020-11-08"],
      targetDate: "2020-11-08",
      year: 2020,
    });

    await expect(proposeNoticeChange({ goalId: estimated.goal.id })).resolves.toBe("none");
    await expect(proposeNoticeChange({ goalId: sameDay.goal.id })).resolves.toBe("none");
  });

  it("proposes a better estimate for a date the plan took from the notice, never for the learner's own", async () => {
    const { blueprint, goal, library } = await plannedExam({
      days: ["2019-11-03"],
      targetDate: null,
      year: 2019,
    });

    await expect(readTargetDate(goal.id)).resolves.toBe("2020-11-01");

    await prisma.examBlueprint.update({
      data: {
        edition: {
          check: null,
          citations: [],
          dates: [{ citation, date: "2019-11-10", kind: "exam", label: "Exam", startTime: null }],
          noticeUrl: null,
          questionCount: null,
          sourceHash: null,
          timeZone: null,
          year: 2019,
        },
      },
      where: { id: blueprint.id },
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    await expect(readTargetDate(goal.id)).resolves.toBe("2020-11-01");

    await expect(proposeNoticeChange({ goalId: goal.id })).resolves.toBe("proposed");
    const [proposal] = await findProposals(goal.id);

    expect(proposal?.payload).toMatchObject({
      operations: [{ estimated: true, kind: "setNoticeDate", targetDate: "2020-11-08" }],
    });

    await decide({ changeId: proposal?.id ?? "", goalId: goal.id, status: "applied" });
    await expect(readTargetDate(goal.id)).resolves.toBe("2020-11-08");
  });

  it("follows the notice's day without asking when it's read before the learner saw the plan", async () => {
    const { blueprint, goal, library } = await plannedExam({
      days: ["2019-11-03"],
      targetDate: null,
      year: 2019,
    });

    await prisma.examBlueprint.update({
      data: {
        edition: {
          check: null,
          citations: [],
          dates: [{ citation, date: "2020-11-15", kind: "exam", label: "Exam", startTime: null }],
          noticeUrl: null,
          questionCount: null,
          sourceHash: null,
          timeZone: null,
          year: 2020,
        },
      },
      where: { id: blueprint.id },
    });

    await followNoticeReading({ goalId: goal.id, graph: library.graph });

    await expect(readTargetDate(goal.id)).resolves.toBe("2020-11-15");
    await expect(proposeNoticeChange({ goalId: goal.id })).resolves.toBe("none");
  });

  it("leaves the plan as it was when a notice's reading lands after the reveal stopped waiting", async () => {
    const { blueprint, goal, library } = await plannedExam({
      days: ["2019-11-03"],
      targetDate: null,
      year: 2019,
    });

    await prisma.examBlueprint.update({
      data: {
        edition: {
          check: null,
          citations: [],
          dates: [{ citation, date: "2020-11-15", kind: "exam", label: "Exam", startTime: null }],
          noticeUrl: null,
          questionCount: null,
          sourceHash: null,
          timeZone: null,
          year: 2020,
        },
      },
      where: { id: blueprint.id },
    });

    await noticeWaitFixture({ goalId: goal.id });
    await expect(claimNoticeLanding({ goalId: goal.id })).resolves.toBe(true);

    const [before, date] = await Promise.all([
      prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } }),
      readTargetDate(goal.id),
    ]);

    vi.setSystemTime(new Date(NOW.getTime() + WAIT_RAN_OUT_MS));

    await expect(
      createGoalPlan({ followNotice: true, goalId: goal.id, graph: library.graph }),
    ).rejects.toSatisfy(isNoticeLandingExpiredError);

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } }),
    ).resolves.toMatchObject({ inputVersion: before.inputVersion, version: before.version });

    await expect(readTargetDate(goal.id)).resolves.toBe(date);
  });

  it("asks before a notice read before the reveal moves the exam out of the month the learner said", async () => {
    const [user, blueprint, library] = await Promise.all([
      userFixture(),
      examBlueprintFixture(),
      planLibraryFixture({ skills: [{ lessons: 1 }, { lessons: 1 }] }),
    ]);

    const { goal } = await unplannedGoalFixture({
      details: { examMonth: 12, examName: "Test Exam", examYear: 2020 },
      examBlueprintId: blueprint.id,
      kind: "exam",
      settings: { startDate: TODAY },
      userId: user.id,
    });

    mockSession(user.id);
    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    await expect(readTargetDate(goal.id)).resolves.toBe("2020-12-01");

    await prisma.examBlueprint.update({
      data: {
        edition: {
          check: null,
          citations: [],
          dates: [{ citation, date: "2020-11-08", kind: "exam", label: "Exam", startTime: null }],
          noticeUrl: null,
          questionCount: null,
          sourceHash: null,
          timeZone: null,
          year: 2020,
        },
      },
      where: { id: blueprint.id },
    });

    await followNoticeReading({ goalId: goal.id, graph: library.graph });
    await expect(readTargetDate(goal.id)).resolves.toBe("2020-12-01");

    await expect(proposeNoticeChange({ goalId: goal.id })).resolves.toBe("proposed");
    const [proposal] = await findProposals(goal.id);

    expect(proposal?.payload).toMatchObject({
      operations: [{ estimated: false, kind: "setNoticeDate", targetDate: "2020-11-08" }],
    });

    await decide({ changeId: proposal?.id ?? "", goalId: goal.id, status: "applied" });
    await expect(readTargetDate(goal.id)).resolves.toBe("2020-11-08");
  });

  it("never asks again about a notice day the learner was offered and kept their month over", async () => {
    const [user, blueprint, library] = await Promise.all([
      userFixture(),
      examBlueprint({ days: ["2020-11-08"], year: 2020 }),
      planLibraryFixture({ skills: [{ lessons: 1 }, { lessons: 1 }] }),
    ]);

    const { goal } = await unplannedGoalFixture({
      details: {
        examMonth: 12,
        examName: "Test Exam",
        examYear: 2020,
        offeredNoticeDay: "2020-11-08",
      },
      examBlueprintId: blueprint.id,
      kind: "exam",
      settings: { startDate: TODAY },
      userId: user.id,
    });

    mockSession(user.id);
    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    await expect(findProposals(goal.id)).resolves.toHaveLength(0);
    await expect(readTargetDate(goal.id)).resolves.toBe("2020-12-01");

    await prisma.examBlueprint.update({
      data: {
        edition: {
          check: null,
          citations: [],
          dates: [{ citation, date: "2020-11-15", kind: "exam", label: "Exam", startTime: null }],
          noticeUrl: null,
          questionCount: null,
          sourceHash: null,
          timeZone: null,
          year: 2020,
        },
      },
      where: { id: blueprint.id },
    });

    await expect(proposeNoticeChange({ goalId: goal.id })).resolves.toBe("proposed");
  });

  it("replaces a notice change still waiting with the newest one", async () => {
    const { blueprint, goal } = await plannedExam({
      days: ["2020-11-08"],
      targetDate: "2020-12-20",
      year: 2020,
    });

    await proposeNoticeChange({ goalId: goal.id });

    await prisma.examBlueprint.update({
      data: {
        edition: {
          check: null,
          citations: [],
          dates: [{ citation, date: "2020-11-15", kind: "exam", label: "Exam", startTime: null }],
          noticeUrl: null,
          questionCount: null,
          sourceHash: null,
          timeZone: null,
          year: 2020,
        },
      },
      where: { id: blueprint.id },
    });

    await proposeNoticeChange({ goalId: goal.id });

    const proposals = await findProposals(goal.id);

    expect(proposals.map((change) => change.payload)).toMatchObject([
      { operations: [{ estimated: false, kind: "setNoticeDate", targetDate: "2020-11-15" }] },
    ]);

    await expect(
      prisma.planChange.findMany({
        select: { status: true },
        where: { id: { notIn: proposals.map((change) => change.id) }, plan: { goalId: goal.id } },
      }),
    ).resolves.toStrictEqual([{ status: "replaced" }]);
  });

  it("follows a late notice once, retaining plan-only additions, completed work and the learner's date", async () => {
    const [library, extra, added] = await Promise.all([
      planLibraryFixture({ skills: [{ lessons: 1 }, { lessons: 1 }] }),
      skillFixture({ name: "Setup lesson" }),
      skillFixture({ name: "Compare antibody types" }),
    ]);

    const [first, outside] = library.graph.skills;

    if (!first || !outside) {
      throw new Error("The library needs two skills");
    }

    const extraSkill = { ...first, area: "Setup", name: extra.name, skillId: extra.id };

    const { blueprint, goal } = await plannedExam({
      days: ["2020-11-08"],
      graph: { ...library.graph, skills: [first, { ...outside, area: "English" }, extraSkill] },
      targetDate: "2020-12-20",
      year: 2020,
    });

    const before = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });

    const done = await prisma.planItem.findFirstOrThrow({
      where: { planId: before.id, skillId: outside.skillId },
    });

    await prisma.planItem.update({
      data: { completedAt: NOW, status: "done" },
      where: { id: done.id },
    });

    const reading = {
      blueprintId: blueprint.id,
      droppedSkillIds: [outside.skillId],
      goalId: goal.id,
      graph: {
        phases: library.graph.phases,
        skills: [
          { ...first, area: "Immunology", topics: ["1 Antibodies"] },
          { ...first, area: "Immunology", name: added.name, skillId: added.id },
        ],
      },
    };

    await expect(applyNoticeGraph(reading)).resolves.toBe(true);
    await applyNoticeGraph(reading);

    const after = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });

    expect(parsePlanGraph(after.graph).skills.map((skill) => skill.skillId)).toStrictEqual([
      first.skillId,
      added.id,
      extra.id,
    ]);

    await expect(prisma.planItem.findUnique({ where: { id: done.id } })).resolves.toMatchObject({
      status: "done",
    });

    await expect(
      prisma.planChange.findMany({ where: { kind: "noticeChanged", planId: before.id } }),
    ).resolves.toMatchObject([
      { payload: { effect: { noticeRemoved: ["English"] } }, status: "applied" },
    ]);

    await expect(readTargetDate(goal.id)).resolves.toBe("2020-12-20");
    await expect(proposeNoticeChange({ goalId: goal.id })).resolves.toBe("proposed");

    await expect(findProposals(goal.id)).resolves.toMatchObject([
      {
        payload: {
          operations: [{ estimated: false, kind: "setNoticeDate", targetDate: "2020-11-08" }],
        },
      },
    ]);

    const notice = await loadTodayPlanChange({ goal, now: NOW, timeZone: "UTC" });

    expect(notice).toMatchObject({
      canApply: false,
      canUndo: false,
      effect: { noticeRemoved: ["English"] },
      kind: "noticeChanged",
    });

    await expect(
      acknowledgeTodayPlanChange({ changeId: notice?.id ?? "", kind: "stored" }),
    ).resolves.toMatchObject({ status: "acknowledged" });

    await expect(loadTodayPlanChange({ goal, now: NOW, timeZone: "UTC" })).resolves.toMatchObject({
      operations: [{ kind: "setNoticeDate" }],
      status: "proposed",
    });
  });

  it("repairs a stored plan without using a plan-only addition as a notice root", async () => {
    const { blueprint, goal, library } = await plannedExam({
      days: ["2020-11-08"],
      targetDate: "2020-12-20",
      year: 2020,
    });

    const [finance, logic] = library.graph.skills;

    if (!finance || !logic) {
      throw new Error("The library needs two skills");
    }

    const setup = await skillFixture({ name: "Use the learner's setup" });

    const setupSkill = {
      ...finance,
      area: "Tools",
      name: setup.name,
      skillId: setup.id,
      topics: [],
    };

    const graph = {
      ...library.graph,
      skills: [
        { ...finance, area: "Finance", topics: ["Budget laws"] },
        { ...logic, area: "Logic", topics: [] },
        setupSkill,
      ],
    };

    await prisma.examBlueprint.update({
      data: {
        structure: {
          formats: [],
          mock: null,
          rules: [],
          subjects: [
            { citation, name: "Finance", questions: 1, topics: ["Budget laws"], weight: 1 },
          ],
        },
      },
      where: { id: blueprint.id },
    });

    await createGoalPlan({ goalId: goal.id, graph });

    const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });

    await planChangeFixture({
      payload: { operations: [{ kind: "addSkills", skills: [setupSkill] }], source: "learner" },
      planId: plan.id,
      status: "applied",
    });

    await expect(applyNoticeGraph({ blueprintId: blueprint.id, goalId: goal.id })).resolves.toBe(
      true,
    );

    await expect(applyNoticeGraph({ blueprintId: blueprint.id, goalId: goal.id })).resolves.toBe(
      false,
    );

    const after = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });

    expect(parsePlanGraph(after.graph).skills.map((skill) => skill.skillId)).toStrictEqual([
      finance.skillId,
      setup.id,
    ]);
  });

  it("lands a waiting legacy graph before replacing it with the exam-day question", async () => {
    const library = await planLibraryFixture({
      skills: [
        { area: "Finance", lessons: 1 },
        { area: "Logic", lessons: 1 },
      ],
    });

    const [finance, logic] = library.graph.skills;

    if (!finance || !logic) {
      throw new Error("Expected Finance and Logic");
    }

    const { blueprint, goal } = await plannedExam({
      days: ["2020-11-08"],
      graph: library.graph,
      targetDate: "2020-12-20",
      year: 2020,
    });

    await prisma.examBlueprint.update({
      data: {
        structure: {
          formats: [],
          mock: null,
          rules: [],
          subjects: [{ citation, name: "Finance", questions: 1, topics: ["Budgets"], weight: 1 }],
        },
      },
      where: { id: blueprint.id },
    });

    const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });

    const legacy = await planChangeFixture({
      kind: "edited",
      payload: {
        effect: {
          endDateAfter: "2020-10-04",
          endDateBefore: "2020-10-05",
          lessonsAdded: 0,
          lessonsRemoved: 1,
        },
        noticeGraph: { ...library.graph, skills: [{ ...finance, topics: ["Budgets"] }] },
        operations: [{ kind: "followNotice" }],
        source: NOTICE_SOURCE,
      },
      planId: plan.id,
      status: "proposed",
    });

    const [today, screen] = await Promise.all([
      loadTodayPlanChange({ goal, now: NOW }),
      readPlanScreen(),
    ]);

    expect.soft(today).toBeNull();
    expect(screen?.changes).toBeDefined();
    expect.soft(screen?.changes).not.toContainEqual(expect.objectContaining({ id: legacy.id }));

    await expect(prisma.planChange.findUnique({ where: { id: legacy.id } })).resolves.toMatchObject(
      { status: "proposed" },
    );

    await expect(proposeNoticeChange({ goalId: goal.id })).resolves.toBe("proposed");

    await expect(prisma.planChange.findUnique({ where: { id: legacy.id } })).resolves.toMatchObject(
      { status: "replaced" },
    );

    const updated = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    expect(parsePlanGraph(updated.graph).skills).toMatchObject([
      { skillId: finance.skillId, topics: ["Budgets"] },
    ]);

    await expect(findProposals(goal.id)).resolves.toMatchObject([
      {
        payload: {
          operations: [{ estimated: false, kind: "setNoticeDate", targetDate: "2020-11-08" }],
        },
      },
    ]);

    await expect(loadTodayPlanChange({ goal, now: NOW })).resolves.toMatchObject({
      effect: { noticeRemoved: ["Logic"] },
      kind: "noticeChanged",
      status: "applied",
    });
  });

  it("says the notice's change once on Today: the news a change carries isn't shown again", async () => {
    const { blueprint, goal } = await plannedExam({
      days: ["2020-11-08"],
      targetDate: "2020-12-20",
      year: 2020,
    });

    const source = await sourceFixture({ language: "en" });

    const notice = await prisma.sourceChangeNotice.create({
      data: {
        contentHash: "new",
        examBlueprintId: blueprint.id,
        language: "en",
        message: "The notice is out: the exam is on November 8, 2020.",
        model: "test",
        previousHash: "old",
        promptVersion: "test",
        runId: "test",
        sourceId: source.id,
      },
    });

    await proposeNoticeChange({ goalId: goal.id, noticeId: notice.id });

    const [proposal] = await findProposals(goal.id);
    expect(proposal?.reason).toBe("The notice is out: the exam is on November 8, 2020.");

    await expect(listGoalChangeNotices({ goalId: goal.id })).resolves.toStrictEqual({
      notices: [],
      status: "ready",
    });
  });

  it("marks replacement of obsolete waiting notices once, with no planning-input bump", async () => {
    const { goal } = await plannedExam({
      days: ["2020-11-08"],
      targetDate: "2020-11-08",
      year: 2020,
    });

    const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });

    const waiting = await planChangeFixture({
      payload: { operations: [], source: NOTICE_SOURCE },
      planId: plan.id,
      status: "proposed",
    });

    await Promise.all([
      proposeNoticeChange({ goalId: goal.id }),
      proposeNoticeChange({ goalId: goal.id }),
    ]);

    await expect(readInputVersion(plan.id)).resolves.toBe(plan.inputVersion);

    await expect(
      prisma.planChange.findUniqueOrThrow({ where: { id: waiting.id } }),
    ).resolves.toMatchObject({ status: "replaced" });
  });
});

async function readInputVersion(planId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
  return plan.inputVersion;
}

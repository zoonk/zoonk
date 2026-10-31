import { prisma } from "@zoonk/db";
import { planChangeFixture } from "@zoonk/testing/fixtures/goals";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { listGoalChangeNotices } from "../library/sources/source-change-notices";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { followNoticeReading } from "./_test-utils/notice-landing";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";
import { decidePlanChange } from "./decide-plan-change";
import { proposeNoticeChange } from "./notice-plan-change";
import { claimNoticeLanding, isNoticeLandingExpiredError, startNoticeWait } from "./notice-wait";
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

function decide({
  changeId,
  goalId,
  status,
}: {
  changeId: string;
  goalId: string;
  status: "applied" | "declined";
}) {
  return decidePlanChange({ changeId, goalId, input: { status, timeZone: "UTC" } });
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

  it("offers the notice's subjects again once per new edition after Keep mine", async () => {
    const { blueprint, goal, library } = await plannedExam({
      days: [],
      targetDate: "2020-12-20",
      year: 2020,
    });

    const noticeGraph: PlanGraph = {
      ...library.graph,
      skills: library.graph.skills.map((skill) => ({ ...skill, area: "Immunology", weight: 3 })),
    };

    const offer = () => proposeNoticeChange({ goalId: goal.id, graph: noticeGraph });

    const keepMine = async () => {
      const [proposal] = await findProposals(goal.id);
      await decide({ changeId: proposal?.id ?? "", goalId: goal.id, status: "declined" });
    };

    await expect(offer()).resolves.toBe("proposed");
    await keepMine();
    await expect(offer()).resolves.toBe("none");

    await prisma.examBlueprint.update({
      data: {
        edition: {
          check: null,
          citations: [],
          dates: [],
          noticeUrl: null,
          questionCount: null,
          sourceHash: null,
          timeZone: null,
          year: 2021,
        },
      },
      where: { id: blueprint.id },
    });

    await expect(offer()).resolves.toBe("proposed");
    await keepMine();
    await expect(offer()).resolves.toBe("none");
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

    await startNoticeWait({ goalId: goal.id });
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

  it("proposes the graph the notice gave with its day, and Apply keeps the skills only the plan has", async () => {
    const [extra, added] = await Promise.all([
      skillFixture({ name: "A setup lesson only this plan has" }),
      skillFixture({ name: "A topic the notice expects" }),
    ]);

    const library = await planLibraryFixture({ skills: [{ lessons: 1 }, { lessons: 1 }] });
    const [first, second] = library.graph.skills;

    if (!first || !second) {
      throw new Error("The library has two skills");
    }

    const extraSkill = { ...first, area: null, name: extra.name, skillId: extra.id };

    const { goal } = await plannedExam({
      days: ["2020-11-08"],
      graph: { ...library.graph, skills: [first, extraSkill, second] },
      targetDate: "2020-12-20",
      year: 2020,
    });

    const noticeGraph: PlanGraph = {
      phases: library.graph.phases,
      skills: [
        { ...first, area: "Immunology", topics: ["1 Antibodies"], weight: 3 },
        { ...first, area: "Immunology", name: added.name, skillId: added.id, weight: 5 },
        { ...second, area: "Immunology", weight: 2 },
      ],
    };

    await expect(proposeNoticeChange({ goalId: goal.id, graph: noticeGraph })).resolves.toBe(
      "proposed",
    );

    const before = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });
    const [proposal] = await findProposals(goal.id);

    expect(parsePlanGraph(before.graph).skills.map((skill) => skill.skillId)).toStrictEqual([
      first.skillId,
      extra.id,
      second.skillId,
    ]);

    expect(proposal?.payload).toMatchObject({
      operations: [
        { kind: "followNotice" },
        { estimated: false, kind: "setNoticeDate", targetDate: "2020-11-08" },
      ],
    });

    await decide({ changeId: proposal?.id ?? "", goalId: goal.id, status: "applied" });

    const after = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });

    expect(
      parsePlanGraph(after.graph).skills.map((skill) => [skill.skillId, skill.area, skill.weight]),
    ).toStrictEqual([
      [first.skillId, "Immunology", 3],
      [added.id, "Immunology", 5],
      [extra.id, null, first.weight],
      [second.skillId, "Immunology", 2],
    ]);

    await expect(readTargetDate(goal.id)).resolves.toBe("2020-11-08");
  });

  it("keeps the subjects a waiting notice change proposes when a newer one only moves the date, and leaves the buddy's proposals alone", async () => {
    const [added, source] = await Promise.all([
      skillFixture({ name: "A topic the corrected notice expects" }),
      sourceFixture({ language: "en" }),
    ]);

    const { blueprint, goal, library } = await plannedExam({
      days: ["2020-11-08"],
      targetDate: "2020-12-20",
      year: 2020,
    });

    const [first, second] = library.graph.skills;

    if (!first || !second) {
      throw new Error("The library has two skills");
    }

    const noticeGraph: PlanGraph = {
      phases: library.graph.phases,
      skills: [
        { ...first, area: "Immunology", weight: 3 },
        { ...first, area: "Immunology", name: added.name, skillId: added.id, weight: 5 },
        { ...second, area: "Immunology", weight: 2 },
      ],
    };

    await expect(proposeNoticeChange({ goalId: goal.id, graph: noticeGraph })).resolves.toBe(
      "proposed",
    );

    const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });

    const buddyProposal = await planChangeFixture({
      kind: "edited",
      payload: {
        operations: [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [6] }],
        source: "planEdit",
      },
      planId: plan.id,
      reason: "Saturdays are off.",
      status: "proposed",
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

    const notice = await prisma.sourceChangeNotice.create({
      data: {
        contentHash: "corrected",
        examBlueprintId: blueprint.id,
        language: "en",
        message: "The exam moved to November 15, 2020.",
        model: "test",
        previousHash: "first",
        promptVersion: "test",
        runId: "test",
        sourceId: source.id,
      },
    });

    await expect(proposeNoticeChange({ goalId: goal.id, noticeId: notice.id })).resolves.toBe(
      "proposed",
    );

    const proposals = await findProposals(goal.id);
    const noticeProposal = proposals.find((change) => change.id !== buddyProposal.id);

    expect(proposals.map((change) => change.id)).toContain(buddyProposal.id);
    expect(proposals).toHaveLength(2);
    expect(noticeProposal?.reason).toBe("");

    expect(noticeProposal?.payload).toMatchObject({
      noticeId: notice.id,
      operations: [
        { kind: "followNotice" },
        { estimated: false, kind: "setNoticeDate", targetDate: "2020-11-15" },
      ],
    });

    await decide({ changeId: noticeProposal?.id ?? "", goalId: goal.id, status: "applied" });

    const after = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });

    expect(parsePlanGraph(after.graph).skills.map((skill) => skill.skillId)).toContain(added.id);
    await expect(readTargetDate(goal.id)).resolves.toBe("2020-11-15");
    await expect(findProposals(goal.id)).resolves.toMatchObject([{ id: buddyProposal.id }]);
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

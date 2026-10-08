import { prisma } from "@zoonk/db";
import { planChangeFixture } from "@zoonk/testing/fixtures/goals";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { listGoalChangeNotices } from "../library/sources/source-change-notices";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";
import { decidePlanChange } from "./decide-plan-change";
import { proposeNoticeChange } from "./notice-plan-change";
import { type PlanGraph, parsePlanGraph } from "./planner/plan-state";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("../progress/get-request-date-context", () => ({ getRequestProgressDateContext: vi.fn() }));
vi.mock("../analytics/server", () => ({ trackServerEvent: vi.fn() }));

/** A Monday in 2020, before the learning events other tests write. */
const NOW = new Date("2020-09-28T12:00:00Z");
const TODAY = "2020-09-28";

const citation = { passage: "", sourceId: "notice" };

/** A stored notice with its exam days. */
function examBlueprint({ days, year }: { days: string[]; year: number }) {
  return examBlueprintFixture({
    edition: {
      citations: [],
      dates: days.map((date) => ({ citation, date, kind: "exam", label: "Exam" })),
      noticeUrl: null,
      questionCount: null,
      sourceHash: null,
      year,
    },
  });
}

/** An exam goal on the stored notice, with its plan built: the learner saw it. */
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
    // The 2019 notice's first Sunday of November falls on the 1st in 2020: the plan's estimate.
    const { blueprint, goal, library } = await plannedExam({
      days: ["2019-11-03"],
      targetDate: null,
      year: 2019,
    });

    await expect(readTargetDate(goal.id)).resolves.toBe("2020-11-01");

    // The notice is read again: its exam is the second Sunday, so the estimate moves a week.
    await prisma.examBlueprint.update({
      data: {
        edition: {
          citations: [],
          dates: [{ citation, date: "2019-11-10", kind: "exam", label: "Exam" }],
          noticeUrl: null,
          questionCount: null,
          sourceHash: null,
          year: 2019,
        },
      },
      where: { id: blueprint.id },
    });

    // A plan rebuilt after the learner saw it (new lessons outlined, say) keeps its date.
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
          citations: [],
          dates: [{ citation, date: "2020-11-15", kind: "exam", label: "Exam" }],
          noticeUrl: null,
          questionCount: null,
          sourceHash: null,
          year: 2020,
        },
      },
      where: { id: blueprint.id },
    });

    await createGoalPlan({ followNotice: true, goalId: goal.id, graph: library.graph });

    await expect(readTargetDate(goal.id)).resolves.toBe("2020-11-15");
    await expect(proposeNoticeChange({ goalId: goal.id })).resolves.toBe("none");
  });

  it("asks before a notice read before the reveal moves the exam out of the month the learner said", async () => {
    // She said "December 2020", and no notice gave a day yet: the plan counts down to December.
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

    // The notice, read while the reveal waits, sets the exam for November.
    await prisma.examBlueprint.update({
      data: {
        edition: {
          citations: [],
          dates: [{ citation, date: "2020-11-08", kind: "exam", label: "Exam" }],
          noticeUrl: null,
          questionCount: null,
          sourceHash: null,
          year: 2020,
        },
      },
      where: { id: blueprint.id },
    });

    await createGoalPlan({ followNotice: true, goalId: goal.id, graph: library.graph });
    await expect(readTargetDate(goal.id)).resolves.toBe("2020-12-01");

    await expect(proposeNoticeChange({ goalId: goal.id })).resolves.toBe("proposed");
    const [proposal] = await findProposals(goal.id);

    expect(proposal?.payload).toMatchObject({
      operations: [{ estimated: false, kind: "setNoticeDate", targetDate: "2020-11-08" }],
    });

    await decide({ changeId: proposal?.id ?? "", goalId: goal.id, status: "applied" });
    await expect(readTargetDate(goal.id)).resolves.toBe("2020-11-08");
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
          citations: [],
          dates: [{ citation, date: "2020-11-15", kind: "exam", label: "Exam" }],
          noticeUrl: null,
          questionCount: null,
          sourceHash: null,
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

    // The earlier one stays on record as replaced, never as kept: the learner never answered it.
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

    // The learner saw this plan: it stays as it is until they apply.
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

    // Research read the notice after the learner saw the plan: its subjects and day wait on Today.
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

    // Then a corrected notice moves the exam a week: a date-only change that says only that.
    await prisma.examBlueprint.update({
      data: {
        edition: {
          citations: [],
          dates: [{ citation, date: "2020-11-15", kind: "exam", label: "Exam" }],
          noticeUrl: null,
          questionCount: null,
          sourceHash: null,
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

    // One change says both, in the app's words, since the notice's message only says the date.
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
});

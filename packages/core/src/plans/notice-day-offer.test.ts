import { prisma } from "@zoonk/db";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getExamView } from "../exams/view/get-exam-view";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { decidePlanChange } from "./decide-plan-change";
import { getGoalPlan } from "./get-goal-plan";
import { getPlanTimeAdvice } from "./get-time-advice";
import { proposeNoticeChange } from "./notice-plan-change";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("../progress/get-request-date-context", () => ({ getRequestProgressDateContext: vi.fn() }));
vi.mock("../analytics/server", () => ({ trackServerEvent: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** A Monday in 2020, before the learning events other tests write. */
const NOW = new Date("2020-09-28T12:00:00Z");
const TODAY = "2020-09-28";

/** The notice's one exam day: a Sunday in November. */
const NOTICE_DAY = "2020-11-08";

const citation = { passage: "", sourceId: "notice" };

/** An exam goal on a stored notice, planned with the learner's own date or month. */
async function plannedExam({
  days = [NOTICE_DAY],
  details = {},
  registrationEnds = [],
  targetDate = null,
}: {
  /** The notice's exam days: its one day, or several sittings. */
  days?: string[];
  details?: Record<string, unknown>;
  /** The last days to register the notice gives, one per sitting in date order. */
  registrationEnds?: string[];
  targetDate?: string | null;
}) {
  const [user, blueprint, library] = await Promise.all([
    userFixture(),
    examBlueprintFixture({
      edition: {
        citations: [],
        dates: [
          ...days.map((date) => ({
            citation,
            date,
            kind: "exam" as const,
            label: "Exam",
            startTime: null,
          })),
          ...registrationEnds.map((date) => ({
            citation,
            date,
            kind: "registrationEnd" as const,
            label: "Registration closes",
            startTime: null,
          })),
        ],
        noticeUrl: null,
        questionCount: null,
        sourceHash: null,
        timeZone: null,
        year: 2020,
      },
      structure: {
        formats: [],
        mock: {
          adaptive: false,
          citations: [],
          order: null,
          scoring: { description: "", method: "raw" },
          sections: [
            { day: 1, minutes: 300, name: "Objective test", questions: 80 },
            { day: 2, minutes: 240, name: "Written test", questions: 4 },
          ],
          timeLimitMinutes: null,
          totalQuestions: 84,
        },
        rules: [],
        subjects: [],
      },
    }),
    planLibraryFixture({ skills: [{ lessons: 1 }, { lessons: 1 }] }),
  ]);

  const { goal } = await unplannedGoalFixture({
    details: { examName: "Test Exam", ...details },
    examBlueprintId: blueprint.id,
    kind: "exam",
    settings: { startDate: TODAY },
    targetDate: targetDate ? new Date(`${targetDate}T00:00:00Z`) : null,
    timezone: "UTC",
    userId: user.id,
  });

  mockSession(user.id);
  await createGoalPlan({ goalId: goal.id, graph: library.graph });

  return goal;
}

async function readPlan(goalId: string) {
  const result = await getGoalPlan(goalId);

  if (result.status !== "ready") {
    throw new Error(`The plan isn't ready: ${result.status}`);
  }

  return result.plan;
}

async function readExam(goalId: string) {
  const result = await getExamView({ goalId, timeZone: "UTC" });

  if (result.status !== "ready") {
    throw new Error(`The exam view isn't ready: ${result.status}`);
  }

  return result.exam;
}

describe("the notice's day where the exam date shows", () => {
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

  it("is offered over the month the learner named, which the exam page says as a month, until she takes it", async () => {
    // She said "December"; the notice says November 8. Her month stays the plan's date.
    const goal = await plannedExam({ details: { examMonth: 12, examYear: 2020 } });

    const [plan, exam] = await Promise.all([readPlan(goal.id), readExam(goal.id)]);

    // Her month, said as that month wherever the plan's date shows.
    expect(plan.schedule).toMatchObject({
      noticeDay: { date: NOTICE_DAY, estimated: false },
      targetDate: "2020-12-01",
      targetDateNamedMonth: true,
    });

    await expect(getPlanTimeAdvice({ goalId: goal.id, input: {} })).resolves.toMatchObject({
      advice: { targetDate: "2020-12-01", targetDateNamedMonth: true },
    });

    expect(exam).toMatchObject({
      days: [{ date: "2020-12-01" }],
      namedMonth: true,
      noticeDay: { date: NOTICE_DAY, estimated: false },
    });

    // Its sittings get no day in her month: she never gave one.
    expect(exam.format.map((day) => day.date)).toStrictEqual([null, null]);

    // Today asks too; one tap on any screen takes the day and answers that question.
    const waiting = await prisma.planChange.findMany({
      where: { plan: { goalId: goal.id }, status: "proposed" },
    });

    expect(waiting).toHaveLength(1);

    await expect(
      changeGoalPlan({
        goalId: goal.id,
        input: { operations: [{ kind: "setTargetDate", targetDate: NOTICE_DAY }], timeZone: "UTC" },
      }),
    ).resolves.toMatchObject({ status: "applied" });

    const [after, examAfter, question] = await Promise.all([
      readPlan(goal.id),
      readExam(goal.id),
      prisma.planChange.findUniqueOrThrow({ where: { id: waiting[0]?.id ?? "" } }),
    ]);

    expect(after.schedule).toMatchObject({
      noticeDay: null,
      targetDate: NOTICE_DAY,
      targetDateNamedMonth: false,
    });

    expect(examAfter).toMatchObject({ days: [{ date: NOTICE_DAY }], namedMonth: false });
    expect(examAfter.format.map((day) => day.date)).toStrictEqual([NOTICE_DAY, null]);
    expect(examAfter.noticeDay).toBeNull();
    expect(question.status).toBe("replaced");
  });

  it("is offered beside a date of the learner's own, which stays until they take the notice's", async () => {
    const goal = await plannedExam({ targetDate: "2020-12-20" });
    const [plan, exam] = await Promise.all([readPlan(goal.id), readExam(goal.id)]);

    expect(plan.schedule).toMatchObject({
      noticeDay: { date: NOTICE_DAY, estimated: false },
      targetDate: "2020-12-20",
    });

    expect(exam).toMatchObject({
      days: [{ date: "2020-12-20" }],
      namedMonth: false,
      noticeDay: { date: NOTICE_DAY, estimated: false },
    });

    const goalAfter = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
    expect(goalAfter.targetDate?.toISOString().slice(0, 10)).toBe("2020-12-20");
  });

  it("isn't offered when the plan counts down to the notice's day", async () => {
    const goal = await plannedExam({});
    const [plan, exam] = await Promise.all([readPlan(goal.id), readExam(goal.id)]);

    expect(plan.schedule).toMatchObject({ noticeDay: null, targetDate: NOTICE_DAY });
    expect(exam).toMatchObject({ namedMonth: false, noticeDay: null });
  });

  // DELE B2's calendar lists a sitting every month or two. Dele said "four months" (February):
  // the plan, Today and the exam page offered the next sitting, six days away.
  it("offers the sitting in the learner's month when the notice lists several, and none when it has none", async () => {
    const days = ["2020-10-16", "2020-11-14", "2021-04-02", "2021-05-22"];

    // Each plans as its own learner, signed in one after the other.
    const april = await plannedExam({ days, targetDate: "2021-04-20" });
    const [aprilPlan, aprilExam] = await Promise.all([readPlan(april.id), readExam(april.id)]);

    expect(aprilPlan.schedule.noticeDay).toStrictEqual({ date: "2021-04-02", estimated: false });
    expect(aprilExam.noticeDay).toStrictEqual({ date: "2021-04-02", estimated: false });

    const february = await plannedExam({ days, targetDate: "2021-02-10" });
    await expect(proposeNoticeChange({ goalId: february.id })).resolves.toBe("none");

    const [plan, exam] = await Promise.all([readPlan(february.id), readExam(february.id)]);

    expect(plan.schedule).toMatchObject({ noticeDay: null, targetDate: "2021-02-10" });
    expect(exam).toMatchObject({ days: [{ date: "2021-02-10" }], noticeDay: null });
  });

  // Dele's DELE B2 without a date planned for the sitting six days away, whose registration had
  // closed a month before.
  it("plans a learner without a date for the next sitting still open for registration", async () => {
    const goal = await plannedExam({
      days: ["2020-10-16", "2020-11-14", "2021-04-02"],
      registrationEnds: ["2020-09-02", "2020-09-25", "2021-02-10"],
    });

    const [plan, exam] = await Promise.all([readPlan(goal.id), readExam(goal.id)]);

    expect(plan.schedule).toMatchObject({
      noSitting: null,
      noticeDay: null,
      targetDate: "2021-04-02",
    });

    expect(exam).toMatchObject({
      days: [{ date: "2021-04-02" }],
      noSitting: null,
      noticeDay: null,
    });

    // An exam's one sitting stays the plan's day after its registration closed: they may be in.
    const single = await plannedExam({ registrationEnds: ["2020-06-01"] });

    await expect(readPlan(single.id)).resolves.toMatchObject({
      schedule: { noticeDay: null, targetDate: NOTICE_DAY },
    });
  });

  // Dele said February; DELE B2 has no sitting then. Nothing told her.
  it("says the learner's month has no exam date, with the closest still open, keeping her date", async () => {
    const days = ["2020-10-16", "2020-11-14", "2021-04-02", "2021-05-22"];

    // November's registration is still open for this learner.
    const open = await plannedExam({ days, targetDate: "2021-02-10" });
    const [openPlan, openExam] = await Promise.all([readPlan(open.id), readExam(open.id)]);
    const both = { closest: ["2020-11-14", "2021-04-02"], month: "2021-02-01" };

    expect(openPlan.schedule).toMatchObject({ noSitting: both, targetDate: "2021-02-10" });
    expect(openExam.noSitting).toStrictEqual(both);

    // For this one it closed: only April's is left to offer.
    const goal = await plannedExam({
      days,
      registrationEnds: ["2020-09-02", "2020-09-25", "2021-02-10", "2021-04-07"],
      targetDate: "2021-02-10",
    });

    const [plan, exam] = await Promise.all([readPlan(goal.id), readExam(goal.id)]);
    const april = { closest: ["2021-04-02"], month: "2021-02-01" };

    expect(plan.schedule).toMatchObject({
      noSitting: april,
      noticeDay: null,
      targetDate: "2021-02-10",
    });

    expect(exam).toMatchObject({ days: [{ date: "2021-02-10" }], noSitting: april });
    await expect(proposeNoticeChange({ goalId: goal.id })).resolves.toBe("none");

    // Picking one makes it her date, and the month has its exam.
    await expect(
      changeGoalPlan({
        goalId: goal.id,
        input: {
          operations: [{ kind: "setTargetDate", targetDate: "2021-04-02" }],
          timeZone: "UTC",
        },
      }),
    ).resolves.toMatchObject({ status: "applied" });

    const [after, examAfter] = await Promise.all([readPlan(goal.id), readExam(goal.id)]);

    expect(after.schedule).toMatchObject({ noSitting: null, targetDate: "2021-04-02" });
    expect(examAfter).toMatchObject({ days: [{ date: "2021-04-02" }], noSitting: null });
  });

  it("says nothing about other sittings when the learner's month has one, or the exam has one sitting", async () => {
    const april = await plannedExam({
      days: ["2020-10-16", "2020-11-14", "2021-04-02"],
      targetDate: "2021-04-20",
    });

    // Each plans as its own learner, signed in one after the other.
    await expect(readPlan(april.id)).resolves.toMatchObject({ schedule: { noSitting: null } });

    const single = await plannedExam({ targetDate: "2021-02-10" });

    await expect(readPlan(single.id)).resolves.toMatchObject({
      schedule: { noSitting: null, noticeDay: { date: NOTICE_DAY } },
    });
  });

  it("shows only the learner's sitting as the exam's day when the notice lists several", async () => {
    const goal = await plannedExam({
      days: ["2020-10-16", "2020-11-14", "2021-04-02"],
      targetDate: "2020-11-14",
    });

    const exam = await readExam(goal.id);

    expect(exam).toMatchObject({ days: [{ date: "2020-11-14" }], noticeDay: null });
  });

  // After "Keep mine" on Today, the exam page still offered the day.
  it("isn't offered anywhere once the learner kept their date over it", async () => {
    const goal = await plannedExam({ targetDate: "2020-12-20" });

    await expect(proposeNoticeChange({ goalId: goal.id })).resolves.toBe("proposed");

    const proposal = await prisma.planChange.findFirstOrThrow({
      where: { plan: { goalId: goal.id }, status: "proposed" },
    });

    await expect(
      decidePlanChange({
        changeId: proposal.id,
        goalId: goal.id,
        input: { status: "declined", timeZone: "UTC" },
      }),
    ).resolves.toMatchObject({ status: "updated" });

    const [plan, exam] = await Promise.all([readPlan(goal.id), readExam(goal.id)]);

    expect(plan.schedule).toMatchObject({ noticeDay: null, targetDate: "2020-12-20" });
    expect(exam.noticeDay).toBeNull();
    await expect(proposeNoticeChange({ goalId: goal.id })).resolves.toBe("none");
  });
});

import { prisma } from "@zoonk/db";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { trackServerEvent } from "../analytics/server";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";
import { getGoalPlan } from "./get-goal-plan";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("../progress/get-request-date-context", () => ({ getRequestProgressDateContext: vi.fn() }));
vi.mock("../analytics/server", () => ({ trackServerEvent: vi.fn() }));

/**
 * A Monday in 2020, before the learning events other tests write: estimates read everyone's recent
 * pace, and this keeps it out of the dates these tests expect.
 */
const NOW = new Date("2020-09-28T12:00:00Z");

function mockClock() {
  vi.mocked(getRequestProgressDateContext).mockResolvedValue({
    currentDate: new Date("2020-09-28T00:00:00Z"),
    currentInstant: NOW,
    timeZone: "UTC",
  });
}

async function setup() {
  const user = await userFixture();

  const library = await planLibraryFixture({
    phases: ["Basics", "Advanced"],
    skills: [{ lessons: 2 }, { lessons: 1 }, { lessons: 0, phase: 1, size: 4 }],
  });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 12,
    settings: { startDate: "2020-09-28" },
    userId: user.id,
  });

  mockSession(user.id);
  mockClock();

  return { goal, library, plan, user };
}

function datesOf(items: { scheduledFor: Date | null }[]) {
  return items.map((item) => item.scheduledFor?.toISOString().slice(0, 10) ?? null);
}

describe(createGoalPlan, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("plans the graph's lessons in order with dates, placeholders and phase checkpoints", async () => {
    const { goal, library, plan } = await setup();

    await expect(createGoalPlan({ goalId: goal.id, graph: library.graph })).resolves.toStrictEqual({
      status: "created",
    });

    const items = await prisma.planItem.findMany({
      orderBy: { position: "asc" },
      where: { planId: plan.id },
    });

    expect(items.map((item) => [item.kind, item.lessonId !== null, item.skillId])).toStrictEqual([
      ["lesson", true, library.skills[0]?.id],
      ["lesson", true, library.skills[0]?.id],
      ["lesson", true, library.skills[1]?.id],
      ["boss", false, null],
      ["lesson", false, library.skills[2]?.id],
      ["boss", false, null],
    ]);

    expect(datesOf(items)).toStrictEqual([
      "2020-09-28",
      "2020-09-28",
      "2020-09-29",
      "2020-09-30",
      "2020-10-02",
      "2020-10-03",
    ]);

    const stored = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    expect(stored.graph).toMatchObject({ skills: library.graph.skills });

    expect(stored.phases).toMatchObject([
      { kind: "learn", name: "Basics", startDate: "2020-09-28" },
      { endDate: "2020-10-03", kind: "learn", name: "Advanced" },
    ]);

    expect(stored.estimateHours).toBeGreaterThan(0);

    expect(stored.settings).toMatchObject({
      pace: { factor: 1, source: "typical" },
      startDate: "2020-09-28",
    });
  });

  it("never shows a lesson another course made first as its own chapter next to this plan's", async () => {
    const { goal, plan } = await setup();

    // Another course made "Describe entanglement"'s lesson first; this plan's course outline put
    // it in its own entanglement chapter, tagged with the plan's next skill.
    const [otherCourseChapter, planChapter, described, correlations] = await Promise.all([
      libraryChapterFixture({ title: "Entanglement" }),
      libraryChapterFixture({ title: "Entanglement and distant correlations" }),
      skillFixture({ name: `Describe entanglement ${crypto.randomUUID()}` }),
      skillFixture({ name: `Compare correlations ${crypto.randomUUID()}` }),
    ]);

    const [shared, own] = await Promise.all([
      libraryLessonFixture({ estimatedMinutes: 3, homeChapterId: otherCourseChapter.id }),
      libraryLessonFixture({ estimatedMinutes: 3, homeChapterId: planChapter.id }),
    ]);

    await Promise.all([
      chapterLessonFixture({ chapterId: otherCourseChapter.id, lessonId: shared.id, position: 0 }),
      chapterLessonFixture({ chapterId: planChapter.id, lessonId: shared.id, position: 0 }),
      chapterLessonFixture({ chapterId: planChapter.id, lessonId: own.id, position: 1 }),
      lessonSkillFixture({ lessonId: shared.id, skillId: described.id }),
      lessonSkillFixture({ lessonId: own.id, skillId: correlations.id }),
      prisma.chapterSkill.create({ data: { chapterId: planChapter.id, skillId: correlations.id } }),
    ]);

    await createGoalPlan({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: "Explain entanglement", name: "Entanglement" }],
        skills: [described, correlations].map((skill) => ({
          area: null,
          lessons: 1,
          name: skill.name,
          phase: 0,
          skillId: skill.id,
          weight: null,
        })),
      },
    });

    const items = await prisma.planItem.findMany({
      orderBy: { position: "asc" },
      where: { kind: "lesson", planId: plan.id },
    });

    expect(items.map((item) => [item.lessonId, item.chapterId])).toStrictEqual([
      [shared.id, planChapter.id],
      [own.id, planChapter.id],
    ]);
  });

  it("leaves out skills the Library doesn't have", async () => {
    const { goal, library, plan } = await setup();

    const unknown = {
      ...library.graph.skills[0],
      skillId: crypto.randomUUID(),
    } as (typeof library.graph.skills)[number];

    await createGoalPlan({
      goalId: goal.id,
      graph: { ...library.graph, skills: [unknown, ...library.graph.skills] },
    });

    const skillIds = await prisma.planItem.findMany({
      select: { skillId: true },
      where: { planId: plan.id },
    });

    expect(skillIds.map((item) => item.skillId)).not.toContain(unknown.skillId);
  });

  it("reports a goal that doesn't exist", async () => {
    await expect(
      createGoalPlan({ goalId: crypto.randomUUID(), graph: { phases: [], skills: [] } }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });
});

describe(getGoalPlan, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("requires the learner's own goal", async () => {
    const { goal } = await setup();

    mockSession(null);
    await expect(getGoalPlan(goal.id)).resolves.toStrictEqual({ status: "unauthorized" });

    const other = await userFixture();
    mockSession(other.id);
    await expect(getGoalPlan(goal.id)).resolves.toStrictEqual({ status: "notFound" });
  });

  it("says a plan isn't ready while the planner hasn't built it", async () => {
    const { goal } = await setup();
    const result = await getGoalPlan(goal.id);

    expect(result.status === "ready" && result.plan).toMatchObject({ phases: [], ready: false });
  });

  it("shows every phase, the current one chapter by chapter, this week and what fits", async () => {
    const { goal, library } = await setup();
    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    const result = await getGoalPlan(goal.id);
    expect(result.status).toBe("ready");

    const plan = result.status === "ready" ? result.plan : null;

    expect(plan).toMatchObject({
      currentPhase: 0,
      feasibility: { coveredShare: 1, deadline: null, fits: true },
      ready: true,
      schedule: { dailyMinutes: 12, studyDays: 7, weekdayMinutes: [12, 12, 12, 12, 12, 12, 12] },
      status: { kind: "onTrack" },
    });

    expect(
      plan?.phases.map((phase) => [phase.name, phase.state, phase.lessonsTotal]),
    ).toStrictEqual([
      ["Basics", "current", 3],
      ["Advanced", "upcoming", 1],
    ]);

    expect(plan?.phases[0]?.chapters).toStrictEqual([
      {
        chapterId: library.chapters[0]?.id,
        lessonsDone: 0,
        lessonsTotal: 3,
        skills: [],
        state: "current",
        testedOut: false,
        title: library.chapters[0]?.title,
        writing: false,
      },
    ]);

    expect(plan?.phases[1]?.chapters).toBeNull();
    expect(plan?.week.startDate).toBe("2020-09-28");
    expect(plan?.week.days[0]).toMatchObject({ date: "2020-09-28", minutes: 12, state: "today" });
    expect(plan?.week.days[0]?.items.map((item) => item.kind)).toStrictEqual(["lesson", "lesson"]);
    expect(plan?.estimate.endDate).toBe("2020-10-03");
    expect(plan?.feasibility?.alternative?.dailyMinutes).toBe(60);
  });

  it('sends "Plan Created" for the first plan only', async () => {
    const { goal, library } = await setup();
    vi.mocked(trackServerEvent).mockClear();

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    expect(trackServerEvent).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        distinctId: goal.userId,
        name: "Plan Created",
        properties: expect.objectContaining({ from_plan_link: false, goal_id: goal.id, phases: 2 }),
      }),
    );
  });
});

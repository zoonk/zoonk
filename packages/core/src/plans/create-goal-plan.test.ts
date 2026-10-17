import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import {
  chapterSkillFixture,
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture, skillPrerequisiteFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { trackServerEvent } from "../analytics/server";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";
import { getGoalPlan } from "./get-goal-plan";

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

/** A four-minute lesson at `position` in a chapter, teaching the skills. */
async function teachingLesson(chapterId: string, position: number, skillIds: string[]) {
  const created = await libraryLessonFixture({ estimatedMinutes: 4, homeChapterId: chapterId });

  await Promise.all([
    chapterLessonFixture({ chapterId, lessonId: created.id, position }),
    ...skillIds.map((skillId) => lessonSkillFixture({ lessonId: created.id, skillId })),
  ]);

  return created;
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

  // Placement was stopped while the plan was still being written, by someone who studied it. The
  // stated level alone tests nothing out (its lower band is only to confirm); a right placement
  // answer of the skill's own does (`plan-setup.test.ts`, "tests out what placement settled once").
  it("tests out nothing from the stated level alone when placement ended before the plan", async () => {
    const user = await userFixture();
    const library = await planLibraryFixture({ skills: [{ lessons: 2 }, { lessons: 1 }] });

    const { goal, plan } = await unplannedGoalFixture({
      dailyMinutes: 12,
      details: { answered: ["level", "placement"], level: "intermediate" },
      settings: { startDate: "2020-09-28" },
      userId: user.id,
    });

    await Promise.all(
      (["beginner", "intermediate"] as const).map((level, index) =>
        prisma.skill.update({ data: { level }, where: { id: library.skills[index]?.id } }),
      ),
    );

    mockSession(user.id);
    mockClock();

    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    const items = await prisma.planItem.findMany({ where: { kind: "lesson", planId: plan.id } });

    expect(items.map((item) => item.status)).toStrictEqual(["todo", "todo", "todo"]);
  });

  it("plans the graph's lessons in order with dates, placeholders and phase checkpoints", async () => {
    const { goal, library, plan } = await setup();

    await expect(createGoalPlan({ goalId: goal.id, graph: library.graph })).resolves.toStrictEqual({
      setupTasks: [],
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
      "2020-10-03",
      "2020-10-04",
    ]);

    const stored = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    expect(stored.graph).toMatchObject({ skills: library.graph.skills });

    expect(stored.phases).toMatchObject([
      { kind: "learn", name: "Basics", startDate: "2020-09-28" },
      { endDate: "2020-10-04", kind: "learn", name: "Advanced" },
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

  it("plans a skill the graph lists no course for from the goal's own course", async () => {
    const user = await userFixture();

    const [physics, enem, skill] = await Promise.all([
      courseFixture({ title: "Physics" }),
      courseFixture({ title: "ENEM" }),
      skillFixture({ name: `Apply Ohm's law ${crypto.randomUUID()}` }),
    ]);

    const { goal, plan } = await unplannedGoalFixture({
      dailyMinutes: 12,
      primaryCourseId: enem.id,
      settings: { startDate: "2020-09-28" },
      userId: user.id,
    });

    mockSession(user.id);
    mockClock();

    // Physics and the ENEM course each teach the shared skill in a chapter of their own.
    const taught = await Promise.all(
      [physics, enem].map(async (course) => {
        const chapter = await libraryChapterFixture({ title: `${course.title} electricity` });

        const lesson = await libraryLessonFixture({
          estimatedMinutes: 3,
          homeChapterId: chapter.id,
        });

        await Promise.all([
          courseChapterFixture({ chapterId: chapter.id, courseId: course.id, position: 0 }),
          chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 }),
          lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
        ]);

        return lesson;
      }),
    );

    await createGoalPlan({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: "Use Ohm's law", name: "Electricity" }],
        skills: [
          { area: null, lessons: 1, name: skill.name, phase: 0, skillId: skill.id, weight: null },
        ],
      },
    });

    const items = await prisma.planItem.findMany({ where: { kind: "lesson", planId: plan.id } });

    expect(items.map((item) => item.lessonId)).toStrictEqual([taught[1]?.id]);
  });

  /*
   * An outline tags a chapter with every graph skill it teaches, not each lesson with its own: the
   * chapter teaches them one after another. Planning all of its lessons under the first skill left
   * the others without lessons of their own, so their topics read as left out of the plan.
   */
  it("gives each skill of a chapter tagged with several its own run of the lessons", async () => {
    const user = await userFixture();

    const [chapter, ...skills] = await Promise.all([
      libraryChapterFixture({ title: "Cells" }),
      skillFixture({ name: "Explain the cell theory" }),
      skillFixture({ name: "Tell organelles apart" }),
      skillFixture({ name: "Compare cell types" }),
    ]);

    const lessons = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        libraryLessonFixture({
          estimatedMinutes: 3,
          homeChapterId: chapter.id,
          title: `Cells ${index + 1}`,
        }),
      ),
    );

    await Promise.all([
      ...skills.map((skill) => chapterSkillFixture({ chapterId: chapter.id, skillId: skill.id })),
      ...lessons.map((lesson, position) =>
        chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position }),
      ),
    ]);

    const { goal, plan } = await unplannedGoalFixture({
      dailyMinutes: 60,
      settings: { startDate: "2020-09-28" },
      userId: user.id,
    });

    mockSession(user.id);
    mockClock();

    await createGoalPlan({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "Cells" }],
        skills: skills.map((skill, index) => ({
          area: "Biology",
          // Each run follows what its skill needs: one lesson, two, then three.
          lessons: index + 1,
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

    expect(items.map((item) => [item.lessonId, item.skillId])).toStrictEqual([
      [lessons[0]?.id, skills[0]?.id],
      [lessons[1]?.id, skills[1]?.id],
      [lessons[2]?.id, skills[1]?.id],
      [lessons[3]?.id, skills[2]?.id],
      [lessons[4]?.id, skills[2]?.id],
      [lessons[5]?.id, skills[2]?.id],
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

  it("lays an exam out as a study cycle: a couple of subjects a day, foundations first", async () => {
    const user = await userFixture();

    // Five subjects of a public-service exam at an hour a day: two subjects a day.
    const library = await planLibraryFixture({
      phases: ["Fundamentos", "Núcleo", "Especialidade"],
      skills: [
        { area: "Língua Portuguesa", lessons: 30, weight: 5 },
        { area: "Direito Constitucional", lessons: 30, weight: 4 },
        { area: "Língua Inglesa", lessons: 30, weight: 3 },
        { area: "Processo Legislativo", lessons: 30, phase: 1, weight: 5 },
        { area: "Reconhecimento de Fala", lessons: 30, phase: 2, weight: 4 },
      ],
    });

    // Parliamentary procedure builds on the constitution's chapter on Congress.
    await prisma.skillPrerequisite.create({
      data: { prerequisiteId: library.skills[1]?.id ?? "", skillId: library.skills[3]?.id ?? "" },
    });

    const { goal, plan } = await unplannedGoalFixture({
      dailyMinutes: 60,
      kind: "exam",
      settings: { startDate: "2020-09-28" },
      targetDate: new Date("2021-01-17T00:00:00Z"),
      userId: user.id,
    });

    mockSession(user.id);
    mockClock();

    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    const items = await prisma.planItem.findMany({
      orderBy: { position: "asc" },
      where: { kind: "lesson", planId: plan.id },
    });

    const areaOf = new Map(library.graph.skills.map((skill) => [skill.skillId, skill.area]));

    const days = Map.groupBy(items, (item) => item.scheduledFor?.toISOString().slice(0, 10) ?? "");

    const subjectsOf = (date: string) => [
      ...new Set((days.get(date) ?? []).map((item) => areaOf.get(item.skillId ?? ""))),
    ];

    expect(subjectsOf("2020-09-28")).toStrictEqual(["Língua Portuguesa", "Direito Constitucional"]);
    expect(subjectsOf("2020-09-29")).toContain("Língua Inglesa");

    // Two subjects a day while they last; a day a subject runs out, the next one due fills it.
    const week = [...days.keys()].slice(0, 6);
    expect(week.every((date) => subjectsOf(date).length === 2)).toBe(true);
    expect([...days.keys()].every((date) => subjectsOf(date).length <= 3)).toBe(true);

    const firstDay = (area: string) =>
      [...days.keys()].findIndex((date) => subjectsOf(date).includes(area));

    // The specialized subjects join once the foundations are under way, and the procedure only
    // once the constitution it builds on has begun.
    expect(firstDay("Processo Legislativo")).toBeGreaterThan(1);
    expect(firstDay("Reconhecimento de Fala")).toBeGreaterThan(firstDay("Processo Legislativo"));

    const firstConstitution = items.findIndex((item) => item.skillId === library.skills[1]?.id);
    const firstProcedure = items.findIndex((item) => item.skillId === library.skills[3]?.id);

    expect(firstProcedure).toBeGreaterThan(firstConstitution);
  });

  it("counts an exam down to the month the learner named while no notice gives its day", async () => {
    const user = await userFixture();
    const library = await planLibraryFixture({ skills: [{ lessons: 4 }] });

    // "The test is in March": the month and year only, and the notice isn't read yet.
    const { goal } = await unplannedGoalFixture({
      dailyMinutes: 30,
      details: { examMonth: 3, examYear: 2021 },
      kind: "exam",
      settings: { startDate: "2020-09-28" },
      userId: user.id,
    });

    mockSession(user.id);
    mockClock();

    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    const [saved, result] = await Promise.all([
      prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
      getGoalPlan(goal.id),
    ]);

    // Ready as that month starts, and said as an estimate until the notice sets the day.
    expect(saved.targetDate?.toISOString().slice(0, 10)).toBe("2021-03-01");

    expect(result.status === "ready" && result.plan.schedule).toMatchObject({
      targetDate: "2021-03-01",
      targetDateEstimated: true,
    });
  });

  it("writes nothing when planning again changes nothing", async () => {
    const { goal, library, plan } = await setup();

    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    const before = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    const items = await prisma.planItem.findMany({ where: { planId: plan.id } });

    await expect(createGoalPlan({ goalId: goal.id, graph: library.graph })).resolves.toStrictEqual({
      setupTasks: [],
      status: "unchanged",
    });

    const after = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    expect(after.version).toBe(before.version);
    expect(after.updatedAt).toStrictEqual(before.updatedAt);

    await expect(prisma.planItem.findMany({ where: { planId: plan.id } })).resolves.toStrictEqual(
      items,
    );

    // A graph that does change the plan is saved, with a new version.
    const [first, ...rest] = library.graph.skills;
    const reordered = { ...library.graph, skills: [...rest, ...(first ? [first] : [])] };

    await expect(createGoalPlan({ goalId: goal.id, graph: reordered })).resolves.toStrictEqual({
      setupTasks: [],
      status: "created",
    });

    const changed = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(changed.version).toBe(before.version + 1);
  });

  it("checks off a lesson the learner finished before the plan existed, from when it ended", async () => {
    const { goal, library, plan, user } = await setup();
    const [finished] = library.lessons;
    const endedAt = new Date("2020-09-28T09:00:00Z");

    if (!finished) {
      throw new Error("The library has no lessons.");
    }

    // A guest's lesson from a public page, before "Build my plan" made the goal: no goal on it.
    await learningEventFixture({ contentIds: { lessonId: finished.id }, endedAt, userId: user.id });
    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    const items = await prisma.planItem.findMany({
      select: { completedAt: true, lessonId: true, status: true },
      where: { kind: "lesson", lessonId: { not: null }, planId: plan.id },
    });

    expect(items).toHaveLength(library.lessons.length);

    expect(items.find((item) => item.lessonId === finished.id)).toStrictEqual({
      completedAt: endedAt,
      lessonId: finished.id,
      status: "done",
    });

    expect(
      items.filter((item) => item.lessonId !== finished.id).map((item) => item.status),
    ).toStrictEqual(["todo", "todo"]);
  });

  // A guest finished "What you own when you buy a share", the first lesson of its chapter, then
  // built the plan from it: the plan put two other chapters first, though the chapter's next lesson
  // was written and builds only on what that lesson taught. The chapter is in progress (R10).
  it("goes on with the chapter of a lesson the learner finished before the plan existed", async () => {
    const user = await userFixture();

    const [first, other, third] = await Promise.all(
      ["Owning a share", "Profits", "Voting"].map((title) => libraryChapterFixture({ title })),
    );

    const [owning, holder, selling] = await Promise.all(
      ["Owning", "Being a holder", "Selling"].map((name) => skillFixture({ name })),
    );

    if (!first || !other || !third || !owning || !holder || !selling) {
      throw new Error("Expected the guest's chapters and skills.");
    }

    // The first lesson teaches owning and being a holder; selling builds on being a holder.
    const [finished, profits, voting, next] = await Promise.all([
      teachingLesson(first.id, 0, [owning.id, holder.id]),
      teachingLesson(other.id, 0, [owning.id]),
      teachingLesson(third.id, 0, [holder.id]),
      teachingLesson(first.id, 1, [selling.id]),
      skillPrerequisiteFixture({ prerequisiteId: holder.id, skillId: selling.id }),
    ]);

    const { goal, plan } = await unplannedGoalFixture({
      dailyMinutes: 12,
      settings: { startDate: "2020-09-28" },
      userId: user.id,
    });

    mockSession(user.id);
    mockClock();

    await learningEventFixture({
      contentIds: { lessonId: finished?.id ?? "" },
      endedAt: new Date("2020-09-28T09:00:00Z"),
      userId: user.id,
    });

    await createGoalPlan({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: "Can read a stock", name: "Basics" }],
        skills: [owning, holder, selling].map((skill) => ({
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
      select: { lessonId: true, status: true },
      where: { kind: "lesson", planId: plan.id },
    });

    expect(items.find((item) => item.lessonId === finished?.id)?.status).toBe("done");

    expect(items.flatMap((item) => (item.status === "todo" ? [item.lessonId] : []))).toStrictEqual([
      next?.id,
      profits?.id,
      voting?.id,
    ]);
  });

  it("reports a goal that doesn't exist", async () => {
    await expect(
      createGoalPlan({ goalId: crypto.randomUUID(), graph: { phases: [], skills: [] } }),
    ).resolves.toStrictEqual({ setupTasks: [], status: "notFound" });
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

    // A phase counts the lessons its stand-in teaches, not one row for them.
    expect(
      plan?.phases.map((phase) => [phase.name, phase.state, phase.lessonsTotal]),
    ).toStrictEqual([
      ["Basics", "current", 3],
      ["Advanced", "upcoming", 4],
    ]);

    expect(plan?.phases[0]?.chapters).toStrictEqual([
      {
        chapterId: library.chapters[0]?.id,
        deeper: false,
        far: false,
        lessonsDone: 0,
        lessonsTotal: 3,
        nextDate: "2020-09-28",
        plannedLessons: null,
        skillId: null,
        skills: [],
        state: "current",
        testedOut: false,
        title: library.chapters[0]?.title,
        writing: false,
      },
    ]);

    // A later phase lists its chapters too, none of them the one the learner is in.
    expect(
      plan?.phases[1]?.chapters.map((chapter) => [chapter.state, chapter.writing]),
    ).toStrictEqual([["upcoming", true]]);

    expect(plan?.week.startDate).toBe("2020-09-28");
    expect(plan?.week.days[0]).toMatchObject({ date: "2020-09-28", minutes: 12, state: "today" });
    expect(plan?.week.days[0]?.items.map((item) => item.kind)).toStrictEqual(["lesson", "lesson"]);
    expect(plan?.estimate.endDate).toBe("2020-10-04");
    // What another daily time would do plans the goal again: a read never works it out.
    expect(plan?.feasibility).not.toHaveProperty("alternative");
  });

  /*
   * A plan's numbers used to be read at a pace sampled again on every read from other learners'
   * recent lessons, so the plan reveal and the Plan, minutes apart, said different times for the
   * same plan. A read takes the pace the plan was saved with; only planning again takes a new one.
   */
  it("reads the plan at the pace it was saved with, however others' lessons went since", async () => {
    const { goal, library } = await setup();
    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    const read = async () => {
      const result = await getGoalPlan(goal.id);
      return result.status === "ready" ? result.plan.estimate : null;
    };

    const before = await read();
    const other = await userFixture();

    // Other learners took twice as long on this plan's lessons the day before. Fewer than the
    // average across all lessons needs, and removed after, so no other test's plan reads them.
    await Promise.all(
      Array.from({ length: 24 }, (_, index) =>
        learningEventFixture({
          contentIds: { lessonId: library.lessons[index % library.lessons.length]?.id },
          endedAt: new Date("2020-09-27T12:00:00Z"),
          seconds: 360,
          userId: other.id,
        }),
      ),
    );

    try {
      await expect(read()).resolves.toStrictEqual(before);
    } finally {
      await prisma.learningEvent.deleteMany({ where: { userId: other.id } });
    }
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

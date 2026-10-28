import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { courseBandsFixture, courseChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { followNoticeReading } from "../plans/_test-utils/notice-landing";
import { planLibraryFixture } from "../plans/_test-utils/plan-library";
import { parsePlanGraph, parsePlanSettings } from "../plans/planner/plan-state";
import { answerOnboardingQuestion } from "../view-models/onboarding/answer-onboarding-question";
import { getOnboarding } from "../view-models/onboarding/get-onboarding";
import { courseGoalStartInputSchema } from "./course-start-contract";
import { startCourseGoal } from "./start-course-goal";

/** Before other tests' learning events, so their pace never changes these plans. */
const NOW = new Date("2020-09-28T12:00:00Z");
const EXAM_DATE = "2020-10-11";

const COURSE_LESSONS = 14;

async function courseLibrary() {
  const [course, library, user] = await Promise.all([
    courseFixture({ isPublished: true, title: "Robotics", visibility: "public" }),
    planLibraryFixture({ skills: [{ area: "Engineering", lessons: 12 }] }),
    userFixture(),
  ]);

  await Promise.all([
    ...library.chapters.map((chapter, position) =>
      courseChapterFixture({ chapterId: chapter.id, courseId: course.id, position }),
    ),
    courseBandsFixture({ courseId: course.id, levels: ["intermediate", "advanced"] }),
  ]);

  mockSession(user.id);
  return { course, library, user };
}

function edition(date = EXAM_DATE) {
  return {
    check: null,
    citations: [],
    dates: [
      {
        citation: { passage: "Exam day", sourceId: "notice" },
        date,
        kind: "exam",
        label: "Exam",
        startTime: null,
      },
    ],
    noticeUrl: null,
    questionCount: null,
    sourceHash: null,
    timeZone: "UTC",
    year: 2020,
  };
}

async function examCourse(
  attrs: Parameters<typeof examBlueprintFixture>[0] = {},
  { deferred = false }: { deferred?: boolean } = {},
) {
  const fixture = await courseLibrary();
  const untaught = deferred ? await skillFixture() : null;

  const blueprint = await examBlueprintFixture({
    edition: edition(),
    examDate: new Date(EXAM_DATE),
    ...attrs,
  });

  await prisma.examSkillGraph.create({
    data: {
      examBlueprintId: blueprint.id,
      generatedAt: NOW,
      graph: untaught
        ? {
            ...fixture.library.graph,
            skills: [
              ...fixture.library.graph.skills,
              {
                area: "Engineering",
                lessons: 2,
                name: untaught.name,
                phase: 0,
                skillId: untaught.id,
                weight: null,
              },
            ],
          }
        : fixture.library.graph,
      model: "test",
      primaryCourseId: fixture.course.id,
      promptVersion: "test",
      runId: crypto.randomUUID(),
    },
  });

  return { ...fixture, blueprint };
}

async function examCourseGraph(examBlueprintId: string) {
  const stored = await prisma.examSkillGraph.findUnique({ where: { examBlueprintId } });
  return stored ? parsePlanGraph(stored.graph) : null;
}

async function readGoal(goalId: string) {
  const goal = await prisma.goal.findUniqueOrThrow({
    include: { plan: { include: { items: true } } },
    where: { id: goalId },
  });

  return {
    goal,
    scheduledLessons: goal.plan?.items.filter(
      (item) => item.kind === "lesson" && item.status === "todo" && item.scheduledFor !== null,
    ).length,
    settings: parsePlanSettings(goal.plan?.settings),
  };
}

async function readSteps(goalId: string) {
  const result = await getOnboarding({ goalId });
  expect(result.status).toBe("ready");
  return result.status === "ready" ? result.onboarding.steps : [];
}

describe("course-start deadlines", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("leaves an ordinary course undated and asks the optional date in onboarding", async () => {
    const { course } = await courseLibrary();
    const result = await startCourseGoal({ courseId: course.id, input: { level: "none" } });
    expect(result.status).toBe("created");
    const goalId = result.status === "created" ? result.goal.id : "";

    const saved = await readGoal(goalId);
    expect(saved.goal.targetDate).toBeNull();
    await expect(readSteps(goalId)).resolves.toContain("targetDate");
  });

  it.each(["2020-09-29", null])(
    "persists an explicit start date %s without asking again",
    async (targetDate) => {
      const { course } = await courseLibrary();

      const input = courseGoalStartInputSchema.parse({
        dailyMinutes: 5,
        level: "none",
        targetDate,
      });

      const result = await startCourseGoal({ courseId: course.id, input });
      expect(result.status).toBe("created");
      const goalId = result.status === "created" ? result.goal.id : "";
      const saved = await readGoal(goalId);

      expect(saved.goal.targetDate?.toISOString().slice(0, 10) ?? null).toBe(targetDate);

      expect(saved.goal.details).toMatchObject({
        answered: expect.arrayContaining(["targetDate"]),
      });

      await expect(readSteps(goalId)).resolves.not.toContain("targetDate");
      expect(saved.scheduledLessons).toBe(targetDate === null ? COURSE_LESSONS : 1);
    },
  );

  it("answers a course date, then clears it on skip and restores the undated plan", async () => {
    const { course } = await courseLibrary();

    const result = await startCourseGoal({
      courseId: course.id,
      input: { dailyMinutes: 5, level: "none" },
    });

    expect(result.status).toBe("created");
    const goalId = result.status === "created" ? result.goal.id : "";
    const undated = await readGoal(goalId);
    expect(undated.scheduledLessons).toBe(COURSE_LESSONS);

    await expect(
      answerOnboardingQuestion({
        goalId,
        input: { question: "targetDate", targetDate: "2020-09-29" },
      }),
    ).resolves.toStrictEqual({ movedTo: null, status: "saved" });

    const dated = await readGoal(goalId);
    expect(dated.scheduledLessons).toBe(1);

    await expect(
      answerOnboardingQuestion({ goalId, input: { question: "targetDate", targetDate: null } }),
    ).resolves.toStrictEqual({ movedTo: null, status: "saved" });

    const cleared = await readGoal(goalId);
    expect(cleared.goal.targetDate).toBeNull();
    expect(cleared.scheduledLessons).toBe(COURSE_LESSONS);
    await expect(readSteps(goalId)).resolves.not.toContain("targetDate");
  });

  it("starts a linked public exam goal with the next notice date and follows its revised date", async () => {
    const { blueprint, course } = await examCourse();
    const result = await startCourseGoal({ courseId: course.id, input: { level: "none" } });

    expect(result).toMatchObject({
      goal: { examBlueprintId: blueprint.id, kind: "exam", targetDate: EXAM_DATE },
      status: "created",
    });

    const goalId = result.status === "created" ? result.goal.id : "";
    const saved = await readGoal(goalId);
    expect(saved.settings.noticeDate).toBe(EXAM_DATE);
    await expect(readSteps(goalId)).resolves.toContain("targetDate");

    await expect(getOnboarding({ goalId })).resolves.toMatchObject({
      onboarding: { examDays: { days: [EXAM_DATE], estimated: false } },
    });

    await prisma.examBlueprint.update({
      data: { edition: edition("2020-10-18") },
      where: { id: blueprint.id },
    });

    await followNoticeReading({ goalId, graph: parsePlanGraph(saved.goal.plan?.graph) });

    const followed = await readGoal(goalId);
    expect(followed.goal.targetDate?.toISOString().slice(0, 10)).toBe("2020-10-18");
    expect(followed.settings.noticeDate).toBe("2020-10-18");
  });

  it("gives a deferred exam start its notice's date right away, which the notice can still move", async () => {
    const { blueprint, course } = await examCourse({}, { deferred: true });
    const result = await startCourseGoal({ courseId: course.id, input: { level: "none" } });

    expect(result).toMatchObject({
      goal: { examBlueprintId: blueprint.id, kind: "exam", targetDate: EXAM_DATE },
      status: "created",
    });

    const goalId = result.status === "created" ? result.goal.id : "";
    const saved = await readGoal(goalId);

    expect(parsePlanGraph(saved.goal.plan?.graph).skills).toHaveLength(0);
    expect(saved.settings.noticeDate).toBe(EXAM_DATE);

    expect(saved.goal.details).toMatchObject({
      answered: expect.not.arrayContaining(["targetDate"]),
    });

    await expect(readSteps(goalId)).resolves.toContain("targetDate");

    await prisma.examBlueprint.update({
      data: { edition: edition("2020-10-18") },
      where: { id: blueprint.id },
    });

    await followNoticeReading({
      goalId,
      graph: (await examCourseGraph(blueprint.id)) ?? parsePlanGraph(null),
    });

    const followed = await readGoal(goalId);
    expect(followed.goal.targetDate?.toISOString().slice(0, 10)).toBe("2020-10-18");
    expect(followed.settings.noticeDate).toBe("2020-10-18");
  });

  it.each(["2020-10-04", null])(
    "keeps a deferred exam start's explicit date %s as the learner's",
    async (targetDate) => {
      const { blueprint, course } = await examCourse({}, { deferred: true });

      const result = await startCourseGoal({
        courseId: course.id,
        input: courseGoalStartInputSchema.parse({ level: "none", targetDate }),
      });

      expect(result).toMatchObject({ goal: { targetDate }, status: "created" });

      const goalId = result.status === "created" ? result.goal.id : "";
      const saved = await readGoal(goalId);

      expect(saved.settings.noticeDate).toBeNull();

      expect(saved.goal.details).toMatchObject({
        answered: expect.arrayContaining(["targetDate"]),
      });

      await expect(readSteps(goalId)).resolves.not.toContain("targetDate");

      await followNoticeReading({
        goalId,
        graph: (await examCourseGraph(blueprint.id)) ?? parsePlanGraph(null),
      });

      const replanned = await readGoal(goalId);
      expect(replanned.goal.targetDate?.toISOString().slice(0, 10) ?? null).toBe(targetDate);
      expect(replanned.settings.noticeDate).toBeNull();
    },
  );

  it("keeps an explicit no-deadline exam undated through graph rebuilds", async () => {
    const { blueprint, course } = await examCourse();

    const result = await startCourseGoal({
      courseId: course.id,
      input: courseGoalStartInputSchema.parse({ level: "none", targetDate: null }),
    });

    expect(result).toMatchObject({
      goal: { examBlueprintId: blueprint.id, kind: "exam", targetDate: null },
      status: "created",
    });

    const goalId = result.status === "created" ? result.goal.id : "";
    const saved = await readGoal(goalId);
    expect(saved.settings.noticeDate).toBeNull();

    await followNoticeReading({ goalId, graph: parsePlanGraph(saved.goal.plan?.graph) });

    const replanned = await readGoal(goalId);
    expect(replanned.goal.targetDate).toBeNull();
    expect(replanned.settings.noticeDate).toBeNull();
    await expect(readSteps(goalId)).resolves.not.toContain("targetDate");

    await expect(getOnboarding({ goalId })).resolves.toMatchObject({
      onboarding: { recommendedMinutes: 60 },
    });
  });

  it.each([EXAM_DATE, "2020-10-04", null])(
    "lets the learner keep, change or remove the default exam date by answering %s",
    async (targetDate) => {
      const { course } = await examCourse();
      const result = await startCourseGoal({ courseId: course.id, input: { level: "none" } });
      expect(result.status).toBe("created");
      const goalId = result.status === "created" ? result.goal.id : "";
      const initial = await readGoal(goalId);
      expect(initial.goal.targetDate?.toISOString().slice(0, 10)).toBe(EXAM_DATE);

      expect(initial.goal.details).toMatchObject({
        answered: expect.not.arrayContaining(["targetDate"]),
      });

      await expect(getOnboarding({ goalId })).resolves.toMatchObject({
        onboarding: {
          goal: { targetDate: EXAM_DATE },
          steps: expect.arrayContaining(["targetDate"]),
        },
        status: "ready",
      });

      await expect(
        answerOnboardingQuestion({ goalId, input: { question: "targetDate", targetDate } }),
      ).resolves.toStrictEqual({ movedTo: null, status: "saved" });

      const answered = await readGoal(goalId);
      expect(answered.goal.targetDate?.toISOString().slice(0, 10) ?? null).toBe(targetDate);

      expect(answered.goal.details).toMatchObject({
        answered: expect.arrayContaining(["targetDate"]),
      });

      await expect(readSteps(goalId)).resolves.not.toContain("targetDate");

      await followNoticeReading({ goalId, graph: parsePlanGraph(answered.goal.plan?.graph) });

      const replanned = await readGoal(goalId);
      expect(replanned.goal.targetDate?.toISOString().slice(0, 10) ?? null).toBe(targetDate);

      expect(replanned.settings.noticeDate).toBe(targetDate === null ? null : EXAM_DATE);
      await expect(readSteps(goalId)).resolves.not.toContain("targetDate");
    },
  );

  it("defaults to the next estimated edition after the stored exam has passed", async () => {
    const { course } = await examCourse({
      edition: { ...edition("2019-10-13"), year: 2019 },
      examDate: new Date("2019-10-13"),
    });

    await expect(startCourseGoal({ courseId: course.id, input: {} })).resolves.toMatchObject({
      goal: { kind: "exam", targetDate: EXAM_DATE },
      status: "created",
    });
  });

  it("asks for an optional date when the linked exam has no stored exam days", async () => {
    const { course } = await examCourse({ edition: { ...edition(), dates: [] }, examDate: null });
    const result = await startCourseGoal({ courseId: course.id, input: {} });

    expect(result).toMatchObject({ goal: { kind: "exam", targetDate: null }, status: "created" });

    const goalId = result.status === "created" ? result.goal.id : "";

    await expect(readSteps(goalId)).resolves.toContain("targetDate");

    await expect(getOnboarding({ goalId })).resolves.toMatchObject({
      onboarding: { examDays: null },
    });
  });

  it("asks for a date when the exam's next day is past what a plan reaches", async () => {
    const far = "2030-10-13";

    const { course } = await examCourse({
      edition: { ...edition(far), year: 2030 },
      examDate: new Date(far),
    });

    const result = await startCourseGoal({ courseId: course.id, input: {} });

    expect(result).toMatchObject({ goal: { kind: "exam", targetDate: null }, status: "created" });

    const goalId = result.status === "created" ? result.goal.id : "";
    const saved = await readGoal(goalId);

    expect(saved.settings.noticeDate ?? null).toBeNull();
    await expect(readSteps(goalId)).resolves.toContain("targetDate");
  });

  it("keeps an exam's supplied date over its notice when replanning", async () => {
    const { course } = await examCourse();

    const result = await startCourseGoal({
      courseId: course.id,
      input: courseGoalStartInputSchema.parse({ targetDate: "2020-10-04" }),
    });

    expect(result.status).toBe("created");
    const goalId = result.status === "created" ? result.goal.id : "";
    const saved = await readGoal(goalId);

    expect(saved.goal.details).toMatchObject({ answered: expect.arrayContaining(["targetDate"]) });

    await expect(readSteps(goalId)).resolves.not.toContain("targetDate");

    await followNoticeReading({ goalId, graph: parsePlanGraph(saved.goal.plan?.graph) });

    const replanned = await readGoal(goalId);
    expect(replanned.goal.targetDate?.toISOString().slice(0, 10)).toBe("2020-10-04");
    expect(replanned.settings.noticeDate).toBeNull();
  });

  it("never uses a private linked blueprint as the public course's exam", async () => {
    const owner = await userFixture();
    const { course } = await examCourse({ ownerId: owner.id, visibility: "private" });
    const result = await startCourseGoal({ courseId: course.id, input: {} });

    expect(result).toMatchObject({
      goal: { examBlueprintId: null, kind: "learn", targetDate: null },
      status: "created",
    });
  });
});

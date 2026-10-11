import { type CourseLevel, prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useIsolatedBudgetDay } from "../_test-utils/isolated-budget-day";
import { mockGuestSession, mockSession } from "../_test-utils/mock-session";
import { loadGoalCurriculumInputs } from "../library/curriculum/goal-curriculum-inputs";
import { parsePlanGraph } from "../plans/planner/plan-state";
import { getOnboarding } from "../view-models/onboarding/get-onboarding";
import { findCourseGoalStart, startCourseGoal } from "./start-course-goal";

/**
 * A Monday in 2020, before the learning events other tests write: estimates read everyone's recent
 * pace, and this keeps it out of the dates these tests expect.
 */
const NOW = new Date("2020-09-28T12:00:00Z");

type ChapterSpec = {
  level: CourseLevel;
  /** Each lesson's skills by name; an empty list is a lesson with none (a chapter's challenge). */
  lessons: string[][];
  /** Skill-graph skills an outline tagged the chapter with. */
  tags?: string[];
  title: string;
};

async function createChapter({
  courseId,
  position,
  skills,
  spec,
}: {
  courseId: string;
  position: number;
  skills: Map<string, string>;
  spec: ChapterSpec;
}) {
  const chapter = await libraryChapterFixture({ level: spec.level, title: spec.title });

  await Promise.all([
    courseChapterFixture({ chapterId: chapter.id, courseId, level: spec.level, position }),
    ...(spec.tags ?? []).map((name) =>
      prisma.chapterSkill.create({
        data: { chapterId: chapter.id, skillId: skills.get(name) ?? "" },
      }),
    ),
    ...spec.lessons.map(async (names, index) => {
      const lesson = await libraryLessonFixture({
        estimatedMinutes: 3,
        level: spec.level,
        title: names.length > 0 ? `Lesson on ${names.join(" and ")}` : `Challenge: ${spec.title}`,
      });

      await chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: index });

      await Promise.all(
        names.map((name) =>
          lessonSkillFixture({ lessonId: lesson.id, skillId: skills.get(name) ?? "" }),
        ),
      );
    }),
  ]);

  return chapter;
}

/**
 * A published course outlined in two bands: Overview with two chapters (the first closes with a
 * challenge through the skill only it is tagged with) and Beginner with one.
 */
const ROBOTICS_OUTLINE: ChapterSpec[] = [
  {
    lessons: [["Sensors"], ["Motors"], []],
    level: "overview",
    tags: ["Build a robot"],
    title: "What robots are made of",
  },
  { lessons: [["Control loops"], ["Feedback"]], level: "overview", title: "How robots decide" },
  { lessons: [["Kinematics"]], level: "beginner", title: "Moving an arm" },
];

/** A published course nobody outlined: enough wherever the outline is never read. */
function publicCourse(attrs: Parameters<typeof courseFixture>[0] = {}) {
  return courseFixture({ isPublished: true, title: "Robotics", visibility: "public", ...attrs });
}

async function outlinedCourse(
  attrs: Parameters<typeof courseFixture>[0] = {},
  specs: ChapterSpec[] = ROBOTICS_OUTLINE,
) {
  const course = await publicCourse(attrs);

  const names = ["Sensors", "Motors", "Build a robot", "Control loops", "Feedback", "Kinematics"];
  const created = await Promise.all(names.map((name) => skillFixture({ name })));
  const skills = new Map(created.map((skill) => [skill.name, skill.id]));

  const chapters = await Promise.all(
    specs.map((spec) =>
      createChapter({
        courseId: course.id,
        position: spec.level === "overview" ? specs.indexOf(spec) : 0,
        skills,
        spec,
      }),
    ),
  );

  return { chapters, course, skills };
}

async function readPlan(goalId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({
    include: { items: { include: { lesson: true }, orderBy: { position: "asc" } } },
    where: { goalId },
  });

  const graph = parsePlanGraph(plan.graph);

  return {
    lessons: plan.items.flatMap((item) => (item.lesson ? [item.lesson.title] : [])),
    phases: graph.phases.map((phase) => phase.name),
    skills: graph.skills.map((skill) => skill.name),
  };
}

describe(startCourseGoal, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("makes the course the learner's goal with its plan built from the course, in its order", async () => {
    const [{ course }, user] = await Promise.all([outlinedCourse(), userFixture()]);
    mockSession(user.id);

    const result = await startCourseGoal({ courseId: course.id, input: { timeZone: "UTC" } });

    expect(result).toMatchObject({
      goal: {
        dailyMinutes: 15,
        details: { courseStart: { chapterId: null } },
        isActive: true,
        kind: "learn",
        plan: { phaseCount: 2, ready: true },
        primaryCourseId: course.id,
        prompt: "Robotics",
        title: "Robotics",
      },
      status: "created",
    });

    const goalId = result.status === "created" ? result.goal.id : "";

    await expect(readPlan(goalId)).resolves.toStrictEqual({
      lessons: [
        "Lesson on Sensors",
        "Lesson on Motors",
        "Challenge: What robots are made of",
        "Lesson on Control loops",
        "Lesson on Feedback",
        "Lesson on Kinematics",
      ],
      phases: ["Overview", "Beginner"],
      skills: ["Sensors", "Motors", "Build a robot", "Control loops", "Feedback", "Kinematics"],
    });
  });

  // Sam left "How much do you already know?" and still had a plan with lessons being written: the
  // start page asks the level before anything exists, and Start brings it along.
  it("takes the level the start page asked, so onboarding goes on without asking it again", async () => {
    const [{ course }, user] = await Promise.all([outlinedCourse(), userFixture()]);
    mockSession(user.id);

    const known = await startCourseGoal({ courseId: course.id, input: { level: "basic" } });

    expect(known).toMatchObject({
      goal: { details: { answered: ["level"], courseStart: { chapterId: null }, level: "basic" } },
      status: "created",
    });

    const onboarding = await getOnboarding({
      goalId: known.status === "created" ? known.goal.id : "",
    });

    const steps = onboarding.status === "ready" ? onboarding.onboarding.steps : [];

    expect(steps).not.toContain("level");
    expect(steps).toContain("placement");
  });

  it("takes a quick test as the level's answer, leaving the level to placement", async () => {
    const [course, user] = await Promise.all([publicCourse(), userFixture()]);
    mockSession(user.id);

    const result = await startCourseGoal({ courseId: course.id, input: { level: null } });
    const goal = result.status === "created" ? result.goal : null;

    expect(goal?.details).toMatchObject({ answered: ["level"] });
    expect(goal?.details).not.toHaveProperty("level");
  });

  it("teaches a skill several chapters share where the course first does, in the course's order", async () => {
    const [{ course }, user] = await Promise.all([
      outlinedCourse({}, [
        ...ROBOTICS_OUTLINE.slice(0, 2),
        { lessons: [["Kinematics", "Motors"]], level: "beginner", title: "Moving an arm" },
      ]),
      userFixture(),
    ]);

    mockSession(user.id);

    const result = await startCourseGoal({ courseId: course.id, input: {} });
    const plan = await readPlan(result.status === "created" ? result.goal.id : "");

    expect(plan.lessons).toStrictEqual([
      "Lesson on Sensors",
      "Lesson on Motors",
      "Lesson on Kinematics and Motors",
      "Challenge: What robots are made of",
      "Lesson on Control loops",
      "Lesson on Feedback",
    ]);
  });

  it("starts the plan at a chapter, leaving the chapters before it out", async () => {
    const [{ chapters, course }, user] = await Promise.all([outlinedCourse(), userFixture()]);
    const decisions = chapters[1]?.id ?? "";
    mockSession(user.id);

    const result = await startCourseGoal({
      courseId: course.id,
      input: { chapterId: decisions, dailyMinutes: 30 },
    });

    expect(result).toMatchObject({
      goal: { dailyMinutes: 30, details: { courseStart: { chapterId: decisions } } },
      status: "created",
    });

    const goalId = result.status === "created" ? result.goal.id : "";
    const plan = await readPlan(goalId);

    expect(plan.phases).toStrictEqual(["Overview", "Beginner"]);
    expect(plan.skills).toStrictEqual(["Control loops", "Feedback", "Kinematics"]);

    expect(plan.lessons).toStrictEqual([
      "Lesson on Control loops",
      "Lesson on Feedback",
      "Lesson on Kinematics",
    ]);
  });

  it("gives a learner back their goal on the course instead of a second one", async () => {
    const [{ course }, user] = await Promise.all([outlinedCourse(), userFixture()]);
    mockSession(user.id);

    const first = await startCourseGoal({ courseId: course.id, input: {} });
    const again = await startCourseGoal({ courseId: course.id, input: {} });

    expect(again).toMatchObject({
      goal: { id: first.status === "created" ? first.goal.id : "" },
      inOnboarding: true,
      status: "existing",
    });

    await expect(prisma.goal.count({ where: { userId: user.id } })).resolves.toBe(1);
  });

  // Asking a returning learner's level again on the start page would be for nothing: the page
  // finds their goal on the course first and sends them back to it.
  it("finds the learner's own goal on the course for its start page, and nobody else's", async () => {
    const [{ course }, user, other] = await Promise.all([
      outlinedCourse(),
      userFixture(),
      userFixture(),
    ]);

    mockSession(user.id);
    await expect(findCourseGoalStart(course.id)).resolves.toBeNull();

    const started = await startCourseGoal({ courseId: course.id, input: { level: "basic" } });

    await expect(findCourseGoalStart(course.id)).resolves.toStrictEqual({
      goalId: started.status === "created" ? started.goal.id : "",
      inOnboarding: true,
    });

    mockSession(other.id);
    await expect(findCourseGoalStart(course.id)).resolves.toBeNull();
  });

  it("says a learner's goal on the course is past onboarding once only the plan is left", async () => {
    const [course, user] = await Promise.all([publicCourse(), userFixture()]);
    mockSession(user.id);

    const goal = await goalFixture({
      details: {
        answered: ["level", "schedule", "age", "memory", "buddy", "placement"],
        courseStart: { chapterId: null },
      },
      primaryCourseId: course.id,
      userId: user.id,
    });

    await expect(startCourseGoal({ courseId: course.id, input: {} })).resolves.toMatchObject({
      goal: { id: goal.id },
      inOnboarding: false,
      status: "existing",
    });
  });

  it("starts a language course as a language goal, with its phases in the course's language", async () => {
    const [{ course }, user] = await Promise.all([
      outlinedCourse({ language: "pt", targetLanguage: "en", title: "Inglês" }),
      userFixture(),
    ]);

    mockSession(user.id);

    const result = await startCourseGoal({ courseId: course.id, input: {} });

    expect(result).toMatchObject({
      goal: { kind: "language", language: "pt", targetLanguage: "en", title: "Inglês" },
      status: "created",
    });

    const plan = await readPlan(result.status === "created" ? result.goal.id : "");
    expect(plan.phases).toStrictEqual(["Visão geral", "Iniciante"]);
  });

  it("leaves a course nobody outlined yet to the goal's first run", async () => {
    const [course, user] = await Promise.all([publicCourse({ title: "Astronomy" }), userFixture()]);

    mockSession(user.id);

    const result = await startCourseGoal({ courseId: course.id, input: {} });

    expect(result).toMatchObject({
      goal: { plan: { ready: false }, primaryCourseId: course.id },
      status: "created",
    });

    await expect(
      prisma.planItem.count({ where: { plan: { goal: { primaryCourseId: course.id } } } }),
    ).resolves.toBe(0);

    // The run writes its curriculum into the course, for the course's own audience.
    await expect(
      loadGoalCurriculumInputs(result.status === "created" ? result.goal.id : ""),
    ).resolves.toMatchObject({
      hasPlanGraph: false,
      startedCourse: { id: course.id, ownerId: null, title: "Astronomy" },
    });
  });

  it("only lets the owner start a private course, and nobody an unlisted one", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);

    const [privateCourse, unlisted] = await Promise.all([
      courseFixture({ userId: owner.id, visibility: "private" }),
      courseFixture({ isPublished: false, visibility: "public" }),
    ]);

    mockSession(other.id);

    await expect(startCourseGoal({ courseId: privateCourse.id, input: {} })).resolves.toStrictEqual(
      { status: "notFound" },
    );

    await expect(startCourseGoal({ courseId: unlisted.id, input: {} })).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(startCourseGoal({ courseId: "not-a-course", input: {} })).resolves.toStrictEqual({
      status: "notFound",
    });

    mockSession(owner.id);

    await expect(startCourseGoal({ courseId: privateCourse.id, input: {} })).resolves.toMatchObject(
      { status: "created" },
    );
  });

  it("refuses a chapter from another course", async () => {
    const [course, other, user] = await Promise.all([
      publicCourse(),
      publicCourse(),
      userFixture(),
    ]);

    const chapter: ChapterSpec = { lessons: [], level: "overview", title: "Introduction" };
    const skills = new Map<string, string>();

    const [, otherChapter] = await Promise.all([
      createChapter({ courseId: course.id, position: 0, skills, spec: chapter }),
      createChapter({ courseId: other.id, position: 0, skills, spec: chapter }),
    ]);

    mockSession(user.id);

    await expect(
      startCourseGoal({ courseId: course.id, input: { chapterId: otherChapter.id } }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await expect(prisma.goal.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("keeps a free learner to one active goal", async () => {
    const [course, learner] = await Promise.all([publicCourse(), userFixture()]);
    await goalFixture({ userId: learner.id });
    mockSession(learner.id);

    await expect(startCourseGoal({ courseId: course.id, input: {} })).resolves.toMatchObject({
      refusals: [{ decision: { limit: { resource: "activeGoals" }, status: "limitReached" } }],
      status: "refused",
    });
  });

  it("keeps a guest to one goal", async () => {
    await useIsolatedBudgetDay();

    const [first, second, guest] = await Promise.all([
      publicCourse(),
      publicCourse({ title: "Astronomy" }),
      userFixture(),
    ]);

    await prisma.user.update({ data: { isAnonymous: true }, where: { id: guest.id } });
    mockGuestSession(guest.id);

    await expect(startCourseGoal({ courseId: first.id, input: {} })).resolves.toMatchObject({
      status: "created",
    });

    await expect(startCourseGoal({ courseId: second.id, input: {} })).resolves.toMatchObject({
      refusals: [{ decision: { limit: { tier: "guest" }, status: "limitReached" } }],
      status: "refused",
    });
  });

  it("needs a session", async () => {
    const course = await publicCourse();
    mockSession(null);

    await expect(startCourseGoal({ courseId: course.id, input: {} })).resolves.toStrictEqual({
      status: "unauthorized",
    });
  });
});

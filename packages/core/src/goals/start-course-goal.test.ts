import { isRateLimited } from "@zoonk/auth/rate-limit";
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
import { mockGuestSession, mockSession } from "../_test-utils/mock-session";
import { loadGoalCurriculumInputs } from "../library/curriculum/goal-curriculum-inputs";
import { parsePlanGraph } from "../plans/planner/plan-state";
import { startCourseGoal } from "./start-course-goal";
import type * as RateLimit from "@zoonk/auth/rate-limit";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** The Vercel Firewall only answers on Vercel, so tests stand in for the adapter that asks it. */
vi.mock("@zoonk/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  isRateLimited: vi.fn(),
}));

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

async function outlinedCourse(
  attrs: Parameters<typeof courseFixture>[0] = {},
  specs: ChapterSpec[] = ROBOTICS_OUTLINE,
) {
  const course = await courseFixture({
    isPublished: true,
    title: "Robotics",
    visibility: "public",
    ...attrs,
  });

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
    vi.mocked(isRateLimited).mockResolvedValue(false);
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

  it("says a learner's goal on the course is past onboarding once only the plan is left", async () => {
    const [{ course }, user] = await Promise.all([outlinedCourse(), userFixture()]);
    mockSession(user.id);

    const goal = await goalFixture({
      details: {
        answered: ["level", "schedule", "age", "mode", "placement"],
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
    const [course, user] = await Promise.all([
      courseFixture({ isPublished: true, title: "Astronomy", visibility: "public" }),
      userFixture(),
    ]);

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
    const [{ course }, other, user] = await Promise.all([
      outlinedCourse(),
      outlinedCourse(),
      userFixture(),
    ]);

    mockSession(user.id);

    await expect(
      startCourseGoal({ courseId: course.id, input: { chapterId: other.chapters[0]?.id } }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await expect(prisma.goal.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("keeps a free learner to one active goal", async () => {
    const [{ course }, learner] = await Promise.all([outlinedCourse(), userFixture()]);
    await goalFixture({ userId: learner.id });
    mockSession(learner.id);

    await expect(startCourseGoal({ courseId: course.id, input: {} })).resolves.toMatchObject({
      refusals: [{ decision: { limit: { resource: "activeGoals" }, status: "limitReached" } }],
      status: "refused",
    });
  });

  it("keeps a guest to one goal", async () => {
    // A day of its own, so the budget guests share in other tests never mixes in.
    vi.setSystemTime(new Date(Date.UTC(2200, 0, 1 + Math.floor(Math.random() * 10_000), 12)));

    const [first, second, guest] = await Promise.all([
      outlinedCourse(),
      outlinedCourse({ title: "Astronomy" }),
      userFixture(),
    ]);

    await prisma.user.update({ data: { isAnonymous: true }, where: { id: guest.id } });
    mockGuestSession(guest.id);

    await expect(startCourseGoal({ courseId: first.course.id, input: {} })).resolves.toMatchObject({
      status: "created",
    });

    await expect(startCourseGoal({ courseId: second.course.id, input: {} })).resolves.toMatchObject(
      {
        refusals: [{ decision: { limit: { tier: "guest" }, status: "limitReached" } }],
        status: "refused",
      },
    );
  });

  it("needs a session", async () => {
    const { course } = await outlinedCourse();
    mockSession(null);

    await expect(startCourseGoal({ courseId: course.id, input: {} })).resolves.toStrictEqual({
      status: "unauthorized",
    });
  });
});

import { randomUUID } from "node:crypto";
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
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useIsolatedBudgetDay } from "../_test-utils/isolated-budget-day";
import { mockGuestSession, mockSession } from "../_test-utils/mock-session";
import { loadGoalCurriculumInputs } from "../library/curriculum/goal-curriculum-inputs";
import { parsePlanGraph } from "../plans/planner/plan-state";
import { getOnboarding } from "../view-models/onboarding/get-onboarding";
import { isResearchedCourseStart } from "./goal-research";
import { findCourseGoalStart, hasCourseGoal, startCourseGoal } from "./start-course-goal";

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
 * A published course outlined in two bands so far: Overview with two chapters (the first closes
 * with a challenge through the skill only it is tagged with) and Beginner with one. Its
 * intermediate and advanced bands aren't written yet.
 */
const PARTIAL_ROBOTICS_OUTLINE: ChapterSpec[] = [
  {
    lessons: [["Sensors"], ["Motors"], []],
    level: "overview",
    tags: ["Build a robot"],
    title: "What robots are made of",
  },
  { lessons: [["Control loops"], ["Feedback"]], level: "overview", title: "How robots decide" },
  { lessons: [["Kinematics"]], level: "beginner", title: "Moving an arm" },
];

/** The same course with every band of its path to mastery written. */
const ROBOTICS_OUTLINE: ChapterSpec[] = [
  ...PARTIAL_ROBOTICS_OUTLINE,
  { lessons: [["Path planning"]], level: "intermediate", title: "Planning a route" },
  { lessons: [["Robot learning"]], level: "advanced", title: "Robots that learn" },
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

  const names = [
    "Sensors",
    "Motors",
    "Build a robot",
    "Control loops",
    "Feedback",
    "Kinematics",
    "Path planning",
    "Robot learning",
  ];

  const created = await Promise.all(names.map((name) => skillFixture({ name })));
  const skills = new Map(created.map((skill) => [skill.name, skill.id]));

  const chapters = await Promise.all(
    specs.map((spec, index) =>
      createChapter({
        courseId: course.id,
        position: specs.slice(0, index).filter((other) => other.level === spec.level).length,
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
        plan: { phaseCount: 4, ready: true },
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
        "Lesson on Path planning",
        "Lesson on Robot learning",
      ],
      phases: ["Overview", "Beginner", "Intermediate", "Advanced"],
      skills: [
        "Sensors",
        "Motors",
        "Build a robot",
        "Control loops",
        "Feedback",
        "Kinematics",
        "Path planning",
        "Robot learning",
      ],
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
        ...ROBOTICS_OUTLINE.slice(3),
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
      "Lesson on Path planning",
      "Lesson on Robot learning",
    ]);
  });

  // A chapter start is the learner's own choice of where to begin, so it plans from the chapters
  // the course has even while later bands are still unwritten.
  it("starts the plan at a chapter, leaving the chapters before it out", async () => {
    const [{ chapters, course }, user] = await Promise.all([
      outlinedCourse({}, PARTIAL_ROBOTICS_OUTLINE),
      userFixture(),
    ]);

    const decisions = chapters[1]?.id ?? "";
    mockSession(user.id);

    const result = await startCourseGoal({
      courseId: course.id,
      input: { chapterId: decisions, dailyMinutes: 30 },
    });

    expect(result).toMatchObject({
      goal: {
        dailyMinutes: 30,
        details: { courseStart: { chapterId: decisions, dailyMinutes: 30 } },
      },
      status: "created",
    });

    const goalId = result.status === "created" ? result.goal.id : "";

    // The time question opens on the time the course's page had, not one from the goal's size.
    await expect(getOnboarding({ goalId })).resolves.toMatchObject({
      onboarding: { examDays: null, recommendedMinutes: 30 },
    });

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

  // The course's public page says "Continue your plan" from one read: the learner's own active
  // goal on the course, never someone else's, a finished one or a question's.
  it("tells the course's page whether the learner's own active goal follows the course", async () => {
    const [course, user, other] = await Promise.all([publicCourse(), userFixture(), userFixture()]);

    mockSession(null);
    await expect(hasCourseGoal(course.id)).resolves.toBe(false);

    mockSession(user.id);
    await expect(hasCourseGoal(course.id)).resolves.toBe(false);
    await expect(hasCourseGoal("not-a-course")).resolves.toBe(false);

    await Promise.all([
      goalFixture({ kind: "explain", primaryCourseId: course.id, userId: user.id }),
      goalFixture({ primaryCourseId: course.id, status: "completed", userId: user.id }),
    ]);

    await expect(hasCourseGoal(course.id)).resolves.toBe(false);

    await goalFixture({ primaryCourseId: course.id, userId: user.id });
    await expect(hasCourseGoal(course.id)).resolves.toBe(true);

    mockSession(other.id);
    await expect(hasCourseGoal(course.id)).resolves.toBe(false);
  });

  it("says a learner's goal on the course is past onboarding once only the plan is left", async () => {
    const [course, user] = await Promise.all([publicCourse(), userFixture()]);
    mockSession(user.id);

    const goal = await goalFixture({
      details: {
        answered: ["targetDate", "level", "schedule", "age", "memory", "buddy", "placement"],
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
    expect(plan.phases).toStrictEqual(["Visão geral", "Iniciante", "Intermediário", "Avançado"]);
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

  // The second learner on a course one goal outlined only in part got a plan of the bands that
  // existed, so the levels the first learner skipped never reached them.
  it("leaves a later learner's plan to the goal's own graph while the course misses a level", async () => {
    const [{ course }, user] = await Promise.all([
      outlinedCourse({}, PARTIAL_ROBOTICS_OUTLINE),
      userFixture(),
    ]);

    mockSession(user.id);

    const result = await startCourseGoal({ courseId: course.id, input: { level: "basic" } });
    const goalId = result.status === "created" ? result.goal.id : "";

    expect(result).toMatchObject({
      goal: { plan: { ready: false }, primaryCourseId: course.id },
      status: "created",
    });

    await expect(prisma.planItem.count({ where: { plan: { goalId } } })).resolves.toBe(0);

    await expect(loadGoalCurriculumInputs(goalId)).resolves.toMatchObject({
      hasPlanGraph: false,
      startedCourse: { id: course.id, ownerId: null, title: "Robotics" },
    });
  });

  // A band whose chapters teach nothing yet made a phase of its own: a checkpoint with nothing to
  // check.
  it("makes phases only of the bands that teach something", async () => {
    const [{ chapters, course }, user] = await Promise.all([
      outlinedCourse({}, [
        ...PARTIAL_ROBOTICS_OUTLINE,
        { lessons: [], level: "intermediate", title: "Planning a route" },
      ]),
      userFixture(),
    ]);

    mockSession(user.id);

    const result = await startCourseGoal({
      courseId: course.id,
      input: { chapterId: chapters[0]?.id ?? "" },
    });

    const plan = await readPlan(result.status === "created" ? result.goal.id : "");
    expect(plan.phases).toStrictEqual(["Overview", "Beginner"]);
  });

  it.each(["running", "failed"] as const)(
    "leaves the plan to the goal's run while the course's outline is %s",
    async (outlineStatus) => {
      const [{ course }, user] = await Promise.all([
        outlinedCourse({ outlineStatus }),
        userFixture(),
      ]);

      mockSession(user.id);

      const result = await startCourseGoal({ courseId: course.id, input: {} });

      expect(result).toMatchObject({ goal: { plan: { ready: false } }, status: "created" });
    },
  );

  // A chapter is placed before its lessons are saved: one whose lessons never landed doesn't teach
  // its part of the band.
  it("leaves the plan to the goal's run while a chapter's lessons haven't landed", async () => {
    const [{ course }, user] = await Promise.all([
      outlinedCourse({}, [
        ...ROBOTICS_OUTLINE,
        { lessons: [], level: "advanced", title: "Robots that see" },
      ]),
      userFixture(),
    ]);

    mockSession(user.id);

    const result = await startCourseGoal({ courseId: course.id, input: {} });

    expect(result).toMatchObject({ goal: { plan: { ready: false } }, status: "created" });
  });

  // An exam course's stored exam names what the course spans: an outline that teaches only part of
  // it gave the learner a plan with the rest of the exam missing.
  it.each([
    ["teaches every skill its exam gives it", ["Sensors", "Kinematics"], "course", true],
    [
      "misses a skill its exam gives it",
      ["Sensors", "Kinematics", "Path planning"],
      "course",
      false,
    ],
    // A graph of one course often names no course: its skills are still this course's to teach.
    ["misses a skill its exam names for no course", ["Sensors", "Path planning"], "none", false],
    // An exam course its graph names nowhere is the whole exam (pt ENEM's gives every skill to a
    // subject course): the whole graph is what it spans.
    ["teaches the whole exam its graph gives other courses", ["Sensors"], "other", true],
    [
      "misses a skill of the whole exam its graph gives other courses",
      ["Sensors", "Path planning"],
      "other",
      false,
    ],
  ] as const)(
    "plans an exam course from its outline only when it %s",
    async (_label, examSkills, attribution, ready) => {
      const [{ course, skills }, user, blueprint] = await Promise.all([
        outlinedCourse({ format: "exam" }, PARTIAL_ROBOTICS_OUTLINE),
        userFixture(),
        examBlueprintFixture({ name: "Robotics exam" }),
      ]);

      await prisma.examSkillGraph.create({
        data: {
          examBlueprintId: blueprint.id,
          generatedAt: NOW,
          graph: {
            phases: [{ milestone: null, name: "Exam" }],
            skills: examSkills.map((name) => ({
              area: null,
              ...(attribution === "none"
                ? {}
                : { courseIds: [attribution === "course" ? course.id : randomUUID()] }),
              lessons: 1,
              name,
              phase: 0,
              skillId: skills.get(name) ?? "",
              weight: null,
            })),
          },
          model: "test",
          primaryCourseId: course.id,
          promptVersion: "test",
          runId: randomUUID(),
        },
      });

      mockSession(user.id);

      const result = await startCourseGoal({ courseId: course.id, input: {} });

      expect(result).toMatchObject({
        goal: { examBlueprintId: blueprint.id, kind: "exam", plan: { ready } },
        status: "created",
      });
    },
  );

  it("marks the default exam date with its notice setting and leaves a repeated start unchanged", async () => {
    const [course, user, blueprint] = await Promise.all([
      publicCourse({ format: "exam" }),
      userFixture(),
      examBlueprintFixture({
        edition: {
          citations: [],
          dates: [
            {
              citation: { passage: "", sourceId: "notice" },
              date: "2020-11-08",
              kind: "exam",
              label: "Exam",
            },
          ],
          noticeUrl: null,
          questionCount: null,
          sourceHash: null,
          year: 2020,
        },
      }),
    ]);

    await prisma.examSkillGraph.create({
      data: {
        examBlueprintId: blueprint.id,
        generatedAt: NOW,
        graph: {},
        model: "test",
        primaryCourseId: course.id,
        promptVersion: "test",
        runId: randomUUID(),
      },
    });

    mockSession(user.id);

    const before = await readRevision(user.id);

    const result = await startCourseGoal({ courseId: course.id, input: {} });

    expect(result).toMatchObject({
      goal: { kind: "exam", targetDate: "2020-11-08" },
      status: "created",
    });

    await expect(readRevision(user.id)).resolves.toBe(before + 4n);
    const goalId = result.status === "created" ? result.goal.id : "";

    await expect(prisma.plan.findUniqueOrThrow({ where: { goalId } })).resolves.toMatchObject({
      inputVersion: 2,
      settings: { noticeDate: "2020-11-08" },
    });

    await startCourseGoal({ courseId: course.id, input: {} });
    await expect(readRevision(user.id)).resolves.toBe(before + 4n);
  });

  it("starts an exam course without a stored exam as an exam goal, which research reads", async () => {
    const [course, user] = await Promise.all([
      publicCourse({ format: "exam", title: "OAB" }),
      userFixture(),
    ]);

    mockSession(user.id);

    const result = await startCourseGoal({ courseId: course.id, input: {} });
    const goal = result.status === "created" ? result.goal : null;

    expect(goal).toMatchObject({ examBlueprintId: null, kind: "exam", primaryCourseId: course.id });
    expect(goal && isResearchedCourseStart(goal)).toBe(true);
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

  it.each([false, true])(
    "rejects another learner's private start without writes (published: %s)",
    async (isPublished) => {
      const [owner, other] = await Promise.all([userFixture(), userFixture()]);
      const course = await courseFixture({ isPublished, userId: owner.id, visibility: "private" });

      mockSession(other.id);

      await expect(
        startCourseGoal({ courseId: course.id, input: { level: "basic" } }),
      ).resolves.toStrictEqual({ status: "notFound" });

      await expect(startCourseGoal({ courseId: randomUUID(), input: {} })).resolves.toStrictEqual({
        status: "notFound",
      });

      mockGuestSession(other.id);

      await expect(startCourseGoal({ courseId: course.id, input: {} })).resolves.toStrictEqual({
        status: "notFound",
      });

      await expect(prisma.goal.count({ where: { userId: other.id } })).resolves.toBe(0);
      await expect(prisma.plan.count({ where: { goal: { userId: other.id } } })).resolves.toBe(0);

      mockSession(owner.id);

      await expect(startCourseGoal({ courseId: course.id, input: {} })).resolves.toMatchObject({
        goal: { primaryCourseId: course.id },
        status: "created",
      });
    },
  );

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

async function readRevision(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return user.learnerRevision;
}

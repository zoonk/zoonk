import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
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
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { after } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sleep } from "workflow";
import { start } from "workflow/api";
import {
  mockGuestSession,
  mockSession,
} from "../../../../packages/core/src/_test-utils/mock-session";
import { finishCourseOutline } from "../../../../packages/core/src/library/curriculum/course-outline-state";
import { getTodayView } from "../../../../packages/core/src/view-models/today/get-today-view";
import { mockHookConflict } from "../../mocks/workflow";
import { getStartMock } from "../workflows/_test-utils/start-mock";
import { courseOutlineWorkflow } from "../workflows/v2/courses/course-outline-workflow";
import {
  scheduleGoalPreparation,
  scheduleSessionPreparation,
  startGoalPreparation,
  startSessionPreparation,
} from "./session-preparation";
import type * as NextServer from "next/server";

vi.mock("@zoonk/core/users/session", () => ({ getSession: vi.fn() }));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof NextServer>()),
  after: vi.fn(),
}));

const TIME_ZONE = "UTC";
const pending: Promise<unknown>[] = [];

function runStartedWorkflowsInline() {
  getStartMock().mockImplementation(async (workflow, args) => {
    if (typeof workflow === "function" && workflow !== courseOutlineWorkflow) {
      pending.push(workflow(...args));
    }

    return { runId: "started-run" } as Awaited<ReturnType<typeof start>>;
  });
}

/** Holds the next started workflow until the test runs it, as a queue would. */
function holdNextStart(): () => Promise<unknown> {
  const held: { run?: () => Promise<unknown> } = {};

  getStartMock().mockImplementationOnce(async (workflow, args) => {
    held.run = async () => typeof workflow === "function" && workflow(...args);
    return { runId: "held-run" } as Awaited<ReturnType<typeof start>>;
  });

  return async () => held.run?.();
}

async function settle() {
  while (pending.length > 0) {
    // oxlint-disable-next-line no-await-in-loop -- Work started by awaited work joins the queue.
    await Promise.all(pending.splice(0));
  }
}

/** The course already teaches a stand-in's skill when the plan hasn't linked its lesson yet. */
async function teachSkill({ course, skillId }: { course: { id: string }; skillId: string }) {
  const chapter = await libraryChapterFixture({ level: "intermediate" });
  const lesson = await libraryLessonFixture({ homeChapterId: chapter.id });

  await Promise.all([
    courseChapterFixture({ chapterId: chapter.id, courseId: course.id, level: "intermediate" }),
    chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 }),
    lessonSkillFixture({ lessonId: lesson.id, skillId }),
  ]);
}

/** A level test tested out the band the plan's build outlined, so the plan now starts on a stand-in. */
async function placedGuestFixture({ guest = true }: { guest?: boolean } = {}) {
  const today = getDateInTimeZone({ date: new Date(), timeZone: TIME_ZONE });

  const [user, course, chapter, basics, next] = await Promise.all([
    userFixture(),
    courseFixture({ outlineStatus: "completed" }),
    libraryChapterFixture({ level: "beginner" }),
    skillFixture({ level: "beginner" }),
    skillFixture({ level: "intermediate" }),
  ]);

  const lesson = await libraryLessonFixture({ homeChapterId: chapter.id });

  const [goal] = await Promise.all([
    goalFixture({
      details: { answered: ["level", "placement"], level: "B1+" },
      kind: "language",
      language: "en",
      primaryCourseId: course.id,
      targetLanguage: "it",
      timezone: TIME_ZONE,
      userId: user.id,
    }),
    prisma.user.update({ data: { isAnonymous: guest }, where: { id: user.id } }),
    courseChapterFixture({ chapterId: chapter.id, courseId: course.id, level: "beginner" }),
    chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 }),
    lessonSkillFixture({ lessonId: lesson.id, skillId: basics.id }),
  ]);

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Italiano" }],
      skills: [basics, next].map((skill) => ({
        area: null,
        courseIds: [course.id],
        lessons: 1,
        name: skill.name,
        phase: 0,
        skillId: skill.id,
        weight: null,
      })),
    },
  });

  await Promise.all([
    planItemFixture({
      chapterId: chapter.id,
      completedAt: today,
      lessonId: lesson.id,
      planId: plan.id,
      position: 0,
      scheduledFor: today,
      skillId: basics.id,
      status: "testedOut",
    }),
    planItemFixture({ planId: plan.id, position: 1, scheduledFor: today, skillId: next.id }),
  ]);

  if (guest) {
    mockGuestSession(user.id);
  } else {
    mockSession(user.id);
  }

  return { course, goal, next, user };
}

type PlacedGuest = Awaited<ReturnType<typeof placedGuestFixture>>;

async function readCourse({ course }: PlacedGuest) {
  return prisma.course.findUniqueOrThrow({
    select: { outlineRunId: true, outlineStatus: true, updatedAt: true },
    where: { id: course.id },
  });
}

async function isDayComing({ goal }: PlacedGuest): Promise<boolean> {
  const view = await getTodayView({ goalId: goal.id, timeZone: TIME_ZONE });

  if (view.status !== "ready" || !view.today.session) {
    throw new Error(`Today did not read for goal ${goal.id}`);
  }

  const { session } = view.today;
  return session.lessonsComing || session.emptyDay === "lessonsComing";
}

async function startSessionFor({ goal, user }: PlacedGuest) {
  const session = await studySessionFixture({ goalId: goal.id, userId: user.id });
  return startSessionPreparation({ sessionId: session.id });
}

async function scheduleSessionFor({ goal, user }: PlacedGuest) {
  const session = await studySessionFixture({ goalId: goal.id, userId: user.id });
  return scheduleSessionPreparation(session.id);
}

describe("preparing a guest's lessons", () => {
  beforeEach(() => {
    pending.length = 0;
    runStartedWorkflowsInline();

    vi.mocked(after).mockImplementation((task) => {
      pending.push(Promise.resolve(typeof task === "function" ? task() : task));
    });
  });

  it.each([
    ["asked for the goal", (guest: PlacedGuest) => startGoalPreparation({ goalId: guest.goal.id })],
    ["after a plan write", (guest: PlacedGuest) => scheduleGoalPreparation(guest.goal.id)],
  ])(
    "says the band's lessons are coming as soon as the learner asks, before any outline starts, %s",
    async (_when, prepare: (guest: PlacedGuest) => Promise<unknown>) => {
      const guest = await placedGuestFixture();
      const course = await readCourse(guest);

      await expect(isDayComing(guest)).resolves.toBe(false);

      await prepare(guest);

      await expect(isDayComing(guest)).resolves.toBe(true);
      await expect(readCourse(guest)).resolves.toStrictEqual(course);

      await settle();

      await expect(isDayComing(guest)).resolves.toBe(true);
    },
  );

  it.each([
    ["asked for the goal", (guest: PlacedGuest) => startGoalPreparation({ goalId: guest.goal.id })],
    ["after a plan write", (guest: PlacedGuest) => scheduleGoalPreparation(guest.goal.id)],
    ["asked for a session", startSessionFor],
    ["after a session write", scheduleSessionFor],
  ])(
    "leaves the shared course to the outline it starts, %s",
    async (_when, prepare: (guest: PlacedGuest) => Promise<unknown>) => {
      const guest = await placedGuestFixture();
      const course = await readCourse(guest);

      await prepare(guest);
      await settle();

      expect(start).toHaveBeenCalledWith(courseOutlineWorkflow, expect.anything());
      await expect(readCourse(guest)).resolves.toStrictEqual(course);
    },
  );

  it("stops saying lessons are coming when the day's stand-in turns out to be taught already", async () => {
    const guest = await placedGuestFixture();
    await teachSkill({ course: guest.course, skillId: guest.next.id });
    const course = await readCourse(guest);

    await startGoalPreparation({ goalId: guest.goal.id });
    await settle();

    expect(start).not.toHaveBeenCalledWith(courseOutlineWorkflow, expect.anything());
    await expect(isDayComing(guest)).resolves.toBe(false);
    await expect(readCourse(guest)).resolves.toStrictEqual(course);
  });

  it("leaves a long-running outline its course, so it can still finish", async () => {
    const guest = await placedGuestFixture();

    await prisma.course.update({
      data: {
        outlineRunId: "long-outline",
        outlineStatus: "running",
        updatedAt: new Date(Date.now() - 20 * 60_000),
      },
      where: { id: guest.course.id },
    });

    const course = await readCourse(guest);

    await startGoalPreparation({ goalId: guest.goal.id });
    await settle();

    await expect(readCourse(guest)).resolves.toStrictEqual(course);
    await expect(isDayComing(guest)).resolves.toBe(true);

    await finishCourseOutline({
      courseId: guest.course.id,
      status: "completed",
      workflowRunId: "long-outline",
    });

    await expect(readCourse(guest)).resolves.toMatchObject({ outlineStatus: "completed" });
  });

  it("keeps the day's lessons coming when another learner's outline of the course finishes first", async () => {
    const guest = await placedGuestFixture();

    await prisma.course.update({
      data: { outlineRunId: "beginner-outline", outlineStatus: "running" },
      where: { id: guest.course.id },
    });

    await startGoalPreparation({ goalId: guest.goal.id });
    await settle();

    await finishCourseOutline({
      courseId: guest.course.id,
      status: "completed",
      workflowRunId: "beginner-outline",
    });

    await expect(isDayComing(guest)).resolves.toBe(true);
  });

  it.each([
    ["asked for the goal", (guest: PlacedGuest) => startGoalPreparation({ goalId: guest.goal.id })],
    ["after a plan write", (guest: PlacedGuest) => scheduleGoalPreparation(guest.goal.id)],
    ["asked for a session", startSessionFor],
    ["after a session write", scheduleSessionFor],
  ])(
    "outlines the band a placement moved the plan to, %s",
    async (_when, prepare: (guest: PlacedGuest) => Promise<unknown>) => {
      const guest = await placedGuestFixture();

      await prepare(guest);
      await settle();

      expect(start).toHaveBeenCalledWith(courseOutlineWorkflow, [
        expect.objectContaining({
          bands: [
            expect.objectContaining({
              level: "intermediate",
              skills: [expect.objectContaining({ id: guest.next.id })],
            }),
          ],
          courseId: guest.course.id,
          forGuest: true,
          waitedSkillId: guest.next.id,
        }),
      ]);
    },
  );
});

describe("preparing an account's lessons", () => {
  beforeEach(() => {
    pending.length = 0;
    runStartedWorkflowsInline();
  });

  it("keeps the day's lessons coming through overlapping asks, one waiting for the other's turn", async () => {
    const account = await placedGuestFixture({ guest: false });
    const course = await readCourse(account);
    const runFirst = holdNextStart();

    await startGoalPreparation({ goalId: account.goal.id });

    mockHookConflict({ returnValue: Promise.resolve(null), runId: "held-run" });
    vi.mocked(sleep).mockImplementationOnce(async () => mockHookConflict(null));

    await startGoalPreparation({ goalId: account.goal.id });
    await settle();
    await runFirst();

    expect(start).toHaveBeenCalledWith(courseOutlineWorkflow, expect.anything());
    await expect(isDayComing(account)).resolves.toBe(true);
    await expect(readCourse(account)).resolves.toStrictEqual(course);
  });

  it("stops saying lessons are coming when its preparation never gets a turn", async () => {
    const account = await placedGuestFixture({ guest: false });
    const course = await readCourse(account);
    const runPreparation = holdNextStart();
    mockHookConflict({ returnValue: Promise.resolve(null), runId: "other-goal-run" });

    await startGoalPreparation({ goalId: account.goal.id });

    await expect(isDayComing(account)).resolves.toBe(true);

    await runPreparation().catch(() => null);

    expect(start).not.toHaveBeenCalledWith(courseOutlineWorkflow, expect.anything());
    await expect(isDayComing(account)).resolves.toBe(false);
    await expect(readCourse(account)).resolves.toStrictEqual(course);
  });
});

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
import { start } from "workflow/api";
import {
  mockGuestSession,
  mockSession,
} from "../../../../packages/core/src/_test-utils/mock-session";
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

async function readOutlineStatus({ course }: PlacedGuest) {
  const row = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });
  return row.outlineStatus;
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
    "marks the band's course as awaiting its outline before the work starts, %s",
    async (_when, prepare: (guest: PlacedGuest) => Promise<unknown>) => {
      const guest = await placedGuestFixture();

      await prepare(guest);

      await expect(readOutlineStatus(guest)).resolves.toBe("pending");

      await settle();
    },
  );

  it.each([
    ["asked for a session", startSessionFor],
    ["after a session write", scheduleSessionFor],
  ])(
    "marks the band's course only once its outline starts, %s",
    async (_when, prepare: (guest: PlacedGuest) => Promise<unknown>) => {
      const guest = await placedGuestFixture();

      await prepare(guest);

      await expect(readOutlineStatus(guest)).resolves.toBe("completed");

      await settle();

      await expect(readOutlineStatus(guest)).resolves.toBe("pending");
    },
  );

  it("gives a course back when its stand-in's skill turns out to be taught already", async () => {
    const guest = await placedGuestFixture();
    await teachSkill({ course: guest.course, skillId: guest.next.id });

    await startGoalPreparation({ goalId: guest.goal.id });
    await settle();

    expect(start).not.toHaveBeenCalledWith(courseOutlineWorkflow, expect.anything());
    await expect(readOutlineStatus(guest)).resolves.toBe("completed");
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

  it("gives the courses it asked for back when another goal's preparation holds the learner", async () => {
    const account = await placedGuestFixture({ guest: false });
    mockHookConflict({ returnValue: Promise.resolve(null), runId: "other-goal-run" });

    await startGoalPreparation({ goalId: account.goal.id });
    await settle();

    expect(start).not.toHaveBeenCalledWith(courseOutlineWorkflow, expect.anything());
    await expect(readOutlineStatus(account)).resolves.toBe("completed");
  });
});

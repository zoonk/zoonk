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
import { isJsonObject } from "@zoonk/utils/json";
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
import { isDayAwaitingOutlines } from "../../../../packages/core/src/sessions/_utils/outlining-stand-ins";
import { getTodayView } from "../../../../packages/core/src/view-models/today/get-today-view";
import { mockHookConflict } from "../../mocks/workflow";
import { getStartMock } from "../workflows/_test-utils/start-mock";
import { courseOutlineWorkflow } from "../workflows/courses/course-outline-workflow";
import { sessionPreparationWorkflow } from "../workflows/sessions/session-preparation-workflow";
import { startGoalPreparation, startSessionPreparation } from "./session-preparation";
import type * as NextServer from "next/server";

vi.mock("@zoonk/core/users/session", () => ({ getSession: vi.fn() }));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof NextServer>()),
  after: vi.fn(),
}));

const TIME_ZONE = "UTC";
const ONBOARDED = ["reason", "level", "targetDate", "buddy", "placement", "schedule"];
const pending: (() => Promise<unknown>)[] = [];

type StartFailure = (workflow: unknown, args: unknown[]) => boolean;

function runStartedWorkflowsInline(fails: StartFailure = () => false) {
  getStartMock().mockImplementation(async (workflow, args) => {
    if (fails(workflow, args)) {
      throw new Error("Could not start the workflow");
    }

    if (typeof workflow === "function" && workflow !== courseOutlineWorkflow) {
      pending.push(async () => workflow(...args));
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
    await Promise.all(pending.splice(0).map((run) => run()));
  }
}

/** The course already teaches a stand-in's skill when the plan hasn't linked its lesson yet. */
async function teachSkill({
  course,
  skillId,
}: {
  course: { id: string };
  skillId: string;
}): Promise<string> {
  const chapter = await libraryChapterFixture({ level: "intermediate" });
  const lesson = await libraryLessonFixture({ homeChapterId: chapter.id });

  await Promise.all([
    courseChapterFixture({ chapterId: chapter.id, courseId: course.id, level: "intermediate" }),
    chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 }),
    lessonSkillFixture({ lessonId: lesson.id, skillId }),
  ]);

  return lesson.id;
}

/** A level test tested out the band the plan's build outlined, so the plan now starts on a stand-in. */
async function placedGuestFixture({
  guest = true,
  laterCourse: withLaterCourse = false,
}: { guest?: boolean; laterCourse?: boolean } = {}) {
  const today = getDateInTimeZone({ date: new Date(), timeZone: TIME_ZONE });

  const [user, course, laterCourse, chapter, basics, next, later] = await Promise.all([
    userFixture(),
    courseFixture({ outlineStatus: "completed" }),
    courseFixture({ outlineStatus: "completed" }),
    libraryChapterFixture({ level: "beginner" }),
    skillFixture({ level: "beginner" }),
    skillFixture({ level: "intermediate" }),
    skillFixture({ level: "advanced" }),
  ]);

  const lesson = await libraryLessonFixture({ homeChapterId: chapter.id });

  const [goal] = await Promise.all([
    goalFixture({
      details: { answered: ONBOARDED, level: "B1+" },
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
      skills: [
        { courseId: course.id, skill: basics },
        { courseId: course.id, skill: next },
        ...(withLaterCourse ? [{ courseId: laterCourse.id, skill: later }] : []),
      ].map(({ courseId, skill }) => ({
        area: null,
        courseIds: [courseId],
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
    withLaterCourse &&
      planItemFixture({
        planId: plan.id,
        position: 2,
        scheduledFor: new Date(today.getTime() + 2 * 86_400_000),
        skillId: later.id,
      }),
  ]);

  if (guest) {
    mockGuestSession(user.id);
  } else {
    mockSession(user.id);
  }

  return { course, goal, laterCourse, next, user };
}

type PlacedGuest = Awaited<ReturnType<typeof placedGuestFixture>>;

/** The course wrote one lesson of the plan's topic and the learner studied it, so today holds only stand-ins of it. */
async function partlyWrittenTopicFixture({
  guest = true,
  standInDays = 0,
}: {
  guest?: boolean;
  /** Days until the stand-in is due: a long one is due on the last day it spans. */
  standInDays?: number;
} = {}) {
  const today = getDateInTimeZone({ date: new Date(), timeZone: TIME_ZONE });
  const yesterday = new Date(today.getTime() - 86_400_000);

  const [user, course, chapter, topic] = await Promise.all([
    userFixture(),
    courseFixture({ outlineStatus: "completed" }),
    libraryChapterFixture({ level: "beginner" }),
    skillFixture({ level: "beginner" }),
  ]);

  const lesson = await libraryLessonFixture({ homeChapterId: chapter.id });

  const [goal] = await Promise.all([
    goalFixture({
      details: { answered: ONBOARDED, level: "A1" },
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
    lessonSkillFixture({ lessonId: lesson.id, skillId: topic.id }),
  ]);

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Italiano" }],
      skills: [
        {
          area: null,
          courseIds: [course.id],
          lessons: 5,
          name: topic.name,
          phase: 0,
          skillId: topic.id,
          weight: null,
        },
      ],
    },
  });

  await Promise.all([
    planItemFixture({
      chapterId: chapter.id,
      completedAt: yesterday,
      lessonId: lesson.id,
      planId: plan.id,
      position: 0,
      scheduledFor: yesterday,
      skillId: topic.id,
      status: "done",
    }),
    planItemFixture({
      planId: plan.id,
      position: 1,
      scheduledFor: new Date(today.getTime() + standInDays * 86_400_000),
      skillId: topic.id,
    }),
  ]);

  if (guest) {
    mockGuestSession(user.id);
  } else {
    mockSession(user.id);
  }

  return { course, goal, topic, user };
}

type PartlyWrittenTopic = Awaited<ReturnType<typeof partlyWrittenTopicFixture>>;

async function readEmptyDay({ goal }: { goal: { id: string } }) {
  const view = await getTodayView({ goalId: goal.id, timeZone: TIME_ZONE });

  if (view.status !== "ready" || !view.today.session) {
    throw new Error(`Today did not read for goal ${goal.id}`);
  }

  return view.today.session.emptyDay;
}

async function readCourse({ course }: PlacedGuest) {
  return prisma.course.findUniqueOrThrow({
    select: { outlineRunId: true, outlineStatus: true, updatedAt: true },
    where: { id: course.id },
  });
}

async function isDayComing({ goal }: PlacedGuest): Promise<boolean> {
  return isDayAwaitingOutlines({
    goal,
    localDate: getDateInTimeZone({ date: new Date(), timeZone: TIME_ZONE }),
  });
}

type GoalOwner = { goal: { id: string }; user: { id: string } };

async function startSessionFor({ goal, user }: GoalOwner) {
  const session = await studySessionFixture({ goalId: goal.id, userId: user.id });
  return startSessionPreparation({ sessionId: session.id });
}

describe("preparing a guest's lessons", () => {
  beforeEach(() => {
    pending.length = 0;
    runStartedWorkflowsInline();

    vi.mocked(after).mockImplementation((task) => {
      pending.push(async () => (typeof task === "function" ? task() : task));
    });
  });

  it("says the band's lessons are coming as soon as the learner asks, before any outline starts", async () => {
    const guest = await placedGuestFixture();
    const course = await readCourse(guest);

    await expect(isDayComing(guest)).resolves.toBe(false);

    await startGoalPreparation({ goalId: guest.goal.id });

    await expect(isDayComing(guest)).resolves.toBe(true);
    await expect(readCourse(guest)).resolves.toStrictEqual(course);
    expect(start).not.toHaveBeenCalledWith(courseOutlineWorkflow, expect.anything());

    await settle();

    await expect(isDayComing(guest)).resolves.toBe(true);
  });

  it.each([
    ["asked for the goal", (guest: PlacedGuest) => startGoalPreparation({ goalId: guest.goal.id })],
    ["asked for a session", startSessionFor],
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

  it("brings in the day's stand-in lesson the course turns out to teach already, instead of saying it's coming", async () => {
    const guest = await placedGuestFixture();
    const lessonId = await teachSkill({ course: guest.course, skillId: guest.next.id });
    const course = await readCourse(guest);

    await startGoalPreparation({ goalId: guest.goal.id });
    await settle();

    expect(start).not.toHaveBeenCalledWith(courseOutlineWorkflow, [
      expect.objectContaining({ courseId: guest.course.id }),
    ]);

    await expect(isDayComing(guest)).resolves.toBe(false);
    await expect(readCourse(guest)).resolves.toStrictEqual(course);

    await expect(
      prisma.planItem.findMany({
        select: { lessonId: true },
        where: { plan: { goalId: guest.goal.id }, skillId: guest.next.id },
      }),
    ).resolves.toStrictEqual([{ lessonId }]);
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
    ["its preparation can't start", (workflow: unknown) => workflow === sessionPreparationWorkflow],
    ["its outlines can't start", (workflow: unknown) => workflow === courseOutlineWorkflow],
  ])(
    "stops saying lessons are coming when %s",
    async (_when, fails: (workflow: unknown) => boolean) => {
      const guest = await placedGuestFixture();
      runStartedWorkflowsInline(fails);

      await startGoalPreparation({ goalId: guest.goal.id }).catch(() => null);
      await settle().catch(() => null);

      await expect(isDayComing(guest)).resolves.toBe(false);
    },
  );

  it.each([
    ["asked for the goal", (guest: PlacedGuest) => startGoalPreparation({ goalId: guest.goal.id })],
    ["asked for a session", startSessionFor],
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

  it.each([
    [
      "asked for the goal",
      (topic: PartlyWrittenTopic) => startGoalPreparation({ goalId: topic.goal.id }),
    ],
    ["asked for a session", startSessionFor],
  ])(
    "writes the next chapter of a topic the course wrote only part of, %s",
    async (_when, prepare: (topic: PartlyWrittenTopic) => Promise<unknown>) => {
      const topic = await partlyWrittenTopicFixture();

      await prepare(topic);
      await settle();

      expect(start).toHaveBeenCalledWith(courseOutlineWorkflow, [
        expect.objectContaining({
          bands: [
            expect.objectContaining({
              extend: [
                expect.objectContaining({ skill: expect.objectContaining({ id: topic.topic.id }) }),
              ],
              level: "beginner",
            }),
          ],
          courseId: topic.course.id,
          forGuest: true,
        }),
      ]);
    },
  );

  it("writes a long partly written topic's next chapter in the foreground while the guest is on it", async () => {
    const topic = await partlyWrittenTopicFixture({ standInDays: 10 });

    await expect(readEmptyDay(topic)).resolves.toBe("lessonsToPrepare");

    await startGoalPreparation({ goalId: topic.goal.id });
    await settle();

    expect(start).toHaveBeenCalledWith(courseOutlineWorkflow, [
      expect.objectContaining({
        background: false,
        bands: [
          expect.objectContaining({
            extend: [
              expect.objectContaining({ skill: expect.objectContaining({ id: topic.topic.id }) }),
            ],
          }),
        ],
        courseId: topic.course.id,
      }),
    ]);

    await expect(readEmptyDay(topic)).resolves.toBe("lessonsComing");
  });

  it("keeps the day's lessons coming after a guest asks for a partly written topic's lessons", async () => {
    const topic = await partlyWrittenTopicFixture();

    await expect(readEmptyDay(topic)).resolves.toBe("lessonsToPrepare");

    await startGoalPreparation({ goalId: topic.goal.id });
    await settle();

    await expect(readEmptyDay(topic)).resolves.toBe("lessonsComing");
  });
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

  it("keeps the day's lessons coming when their outline starts and another one can't", async () => {
    const account = await placedGuestFixture({ guest: false, laterCourse: true });

    runStartedWorkflowsInline(
      (workflow, [input]) =>
        workflow === courseOutlineWorkflow &&
        isJsonObject(input) &&
        input.courseId === account.laterCourse.id,
    );

    await startGoalPreparation({ goalId: account.goal.id });
    await settle().catch(() => null);

    expect(start).toHaveBeenCalledWith(courseOutlineWorkflow, [
      expect.objectContaining({ courseId: account.course.id }),
    ]);

    await expect(isDayComing(account)).resolves.toBe(true);
  });
});

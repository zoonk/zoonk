import { randomUUID } from "node:crypto";
import { type GoalTutorLookUpRequest } from "@zoonk/ai/tasks/v2/tutor/goal-tutor-lookup";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { catalogCourseFixture } from "@zoonk/testing/fixtures/library-courses";
import { milestoneFixture } from "@zoonk/testing/fixtures/memory";
import { dailyProgressFixtureMany, userProgressFixture } from "@zoonk/testing/fixtures/progress";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { mockSession } from "../_test-utils/mock-session";
import { getUsageRule } from "../entitlements/limits";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { toIsoDate } from "../plans/planner/plan-calendar";
import { BRAIN_POWER_BONUS } from "../sessions/brain-power";
import { claimLessonQuestionAnswer } from "./answer-lifecycle";
import { createLessonQuestion } from "./create-lesson-question";
import { lookUpTutorData } from "./look-up-tutor-data";

const MODEL = "openai/gpt-6-luna";

/**
 * A learner whose goal has a plan row and no lessons, open in the app unless `open` is false (then
 * another of their goals is the one open).
 */
async function learnerWithGoal({ open = true }: { open?: boolean } = {}) {
  const user = await userFixture();

  const goal = await goalFixture({
    timezone: "UTC",
    title: `Goal ${randomUUID()}`,
    userId: user.id,
  });

  await planFixture({ goalId: goal.id, graph: { phases: [], skills: [] } });

  if (!open) {
    const other = await goalFixture({ title: `Open ${randomUUID()}`, userId: user.id });
    await learningProfileFixture({ activeGoalId: other.id, userId: user.id });
  }

  mockSession(user.id);
  return { goal, user };
}

/**
 * A learner with a built plan teaching Math, then Biology: each skill in a chapter of its own,
 * which Progress counts as an area.
 */
async function plannedLearner({ open = true }: { open?: boolean } = {}) {
  const user = await userFixture();

  const library = await planLibraryFixture({
    phases: ["Math", "Biology"],
    skills: [
      { area: "Math", lessons: 2, phase: 0 },
      { area: "Biology", lessons: 2, phase: 1 },
    ],
  });

  const { goal } = await unplannedGoalFixture({ timezone: "UTC", userId: user.id });
  await createGoalPlan({ goalId: goal.id, graph: library.graph });

  if (!open) {
    const other = await goalFixture({ userId: user.id });
    await learningProfileFixture({ activeGoalId: other.id, userId: user.id });
  }

  mockSession(user.id);
  return { goal, library, user };
}

/** The buddy's answer being written for a question about the goal. */
async function answering(goalId: string) {
  const created = await createLessonQuestion({
    input: { context: { kind: "plan" }, question: "How am I doing?", requestId: randomUUID() },
    target: { goalId, kind: "plan" },
  });

  if (created.status !== "created") {
    throw new Error(`Expected a created question, received ${created.status}`);
  }

  const claimed = await claimLessonQuestionAnswer({
    questionId: created.question.id,
    requestedModel: MODEL,
  });

  if (claimed.status !== "ready") {
    throw new Error(`Expected a claimed answer, received ${claimed.status}`);
  }

  return { questionId: created.question.id, revision: claimed.claim.revision };
}

function lookUp(
  asked: { questionId: string; revision: number },
  request: Partial<GoalTutorLookUpRequest> & Pick<GoalTutorLookUpRequest, "what">,
) {
  return lookUpTutorData({ area: null, query: null, ...asked, ...request });
}

/** Today's session with a lesson to do, a finished review and the missions saved for the day. */
async function savedDay({ goalId, userId }: { goalId: string; userId: string }) {
  const session = await studySessionFixture({
    goalId,
    localDate: toUTCMidnight(new Date()),
    missions: {
      picks: [
        { anchor: { blockKind: "learn" }, kind: "somethingNew", total: 1 },
        { anchor: { blockKind: "review" }, kind: "review", total: 1 },
        { anchor: {}, kind: "fixMistake", opens: { kind: "mistakesPractice" }, total: 1 },
        { anchor: {}, kind: "pronunciation", opens: { kind: "pronunciation" }, total: 1 },
        { anchor: {}, kind: "call", opens: { chapterId: randomUUID(), kind: "call" }, total: 1 },
      ],
      version: 1,
    },
    userId,
  });

  const [learn] = await Promise.all([
    studySessionBlockFixture({ kind: "learn", position: 0, sessionId: session.id }),
    studySessionBlockFixture({
      brainPower: 20,
      kind: "review",
      position: 1,
      sessionId: session.id,
      status: "completed",
    }),
  ]);

  return { learn, session };
}

describe("the learner's data the buddy looks up", () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("reads today's missions as Today shows them, with where each opens and the Brain Power", async () => {
    freezeClock();
    const [{ goal, user }, other] = await Promise.all([learnerWithGoal(), learnerWithGoal()]);

    const [{ learn }] = await Promise.all([
      savedDay({ goalId: goal.id, userId: user.id }),
      savedDay({ goalId: other.goal.id, userId: other.user.id }),
      userProgressFixture({ totalBrainPower: 1234n, userId: user.id }),
      userProgressFixture({ totalBrainPower: 99_999n, userId: other.user.id }),
    ]);

    mockSession(user.id);
    const asked = await answering(goal.id);

    await expect(lookUp(asked, { what: "missions" })).resolves.toStrictEqual({
      bonus: { brainPower: BRAIN_POWER_BONUS.fullMeal, earned: false },
      brainPower: { today: 20, total: 1234 },
      date: toIsoDate(toUTCMidnight(new Date())),
      missions: [
        expect.objectContaining({
          done: 0,
          kind: "somethingNew",
          link: { blockId: learn.id, kind: "block" },
          status: "todo",
          total: 1,
        }),
        expect.objectContaining({ done: 1, kind: "review", link: null, status: "done" }),
        expect.objectContaining({
          kind: "fixMistake",
          link: { kind: "page", page: "mistakesPractice" },
          status: "todo",
        }),
        expect.objectContaining({
          kind: "pronunciation",
          link: { kind: "page", page: "pronunciation" },
        }),
        expect.objectContaining({ kind: "call", link: null, status: "todo" }),
      ],
      moreMissions: 0,
      status: "found",
      what: "missions",
    });
  });

  it("links no mission to the open goal's day when this goal isn't the one open", async () => {
    freezeClock();
    const { goal, user } = await learnerWithGoal({ open: false });
    await savedDay({ goalId: goal.id, userId: user.id });

    const asked = await answering(goal.id);

    await expect(lookUp(asked, { what: "missions" })).resolves.toMatchObject({
      missions: [
        { kind: "somethingNew", link: null },
        { kind: "review", link: null },
        { kind: "fixMistake", link: null },
        { kind: "pronunciation", link: null },
        { kind: "call", link: null },
      ],
      status: "found",
    });
  });

  it("finds no missions before the day is built", async () => {
    const { goal } = await learnerWithGoal();
    const asked = await answering(goal.id);

    await expect(lookUp(asked, { what: "missions" })).resolves.toStrictEqual({
      status: "notFound",
      what: "missions",
    });
  });

  it("lists the learner's own goals, the open one linked to its Plan, bounded", async () => {
    const [{ goal, user }, other] = await Promise.all([learnerWithGoal(), userFixture()]);

    // The oldest of the rest, a minute before any of them, so it's shown second even when the
    // others share its millisecond (goals are listed by creation time alone).
    const paused = await goalFixture({
      createdAt: new Date(Date.now() - 60_000),
      status: "paused",
      targetDate: new Date("2027-06-01T00:00:00Z"),
      title: `Paused ${randomUUID()}`,
      userId: user.id,
    });

    const [otherGoal] = await Promise.all([
      goalFixture({ title: `Theirs ${randomUUID()}`, userId: other.id }),
      goalFixture({ status: "archived", title: "Archived", userId: user.id }),
      ...Array.from({ length: 9 }, () => goalFixture({ userId: user.id })),
    ]);

    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });

    const asked = await answering(goal.id);
    const result = await lookUp(asked, { what: "goals" });

    if (result.status !== "found" || result.what !== "goals") {
      throw new Error(`Expected goals, received ${result.status}`);
    }

    // Eleven goals not archived: the open one first, ten shown.
    expect(result.goals).toHaveLength(10);
    expect(result.moreGoals).toBe(1);

    expect(result.goals[0]).toStrictEqual({
      dailyMinutes: goal.dailyMinutes,
      kind: "learn",
      link: { kind: "page", page: "plan" },
      open: true,
      plan: { endDate: null, lessonsDone: 0, lessonsTotal: 0 },
      status: "active",
      targetDate: null,
      thisGoal: true,
      title: goal.title,
    });

    expect(result.goals[1]).toMatchObject({
      link: null,
      open: false,
      status: "paused",
      targetDate: "2027-06-01",
      thisGoal: false,
      title: paused.title,
    });

    expect(result.goals.filter((view) => !view.open).every((view) => view.link === null)).toBe(
      true,
    );

    const raw = JSON.stringify(result);

    expect(raw).not.toContain(otherGoal.title);
    expect(raw).not.toContain("Archived");
  });

  it("links no goal's Plan when this goal isn't the one open", async () => {
    const { goal } = await learnerWithGoal({ open: false });
    const asked = await answering(goal.id);

    await expect(lookUp(asked, { what: "goals" })).resolves.toMatchObject({
      goals: [
        { link: null, open: true, thisGoal: false },
        { link: null, open: false, thisGoal: true, title: goal.title },
      ],
      moreGoals: 0,
      status: "found",
    });
  });

  it("reads the account: Plus, the call time left, memory and preferences, with their pages", async () => {
    const [{ goal, user }, free] = await Promise.all([
      learnerWithGoal(),
      learnerWithGoal({ open: false }),
    ]);

    await Promise.all([
      prisma.subscription.create({
        data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
      }),
      learningProfileFixture({
        activeGoalId: goal.id,
        buddyKind: "noodle",
        buddyName: "Pip",
        dailyLimitMinutes: 45,
        memoryEnabled: false,
        soundsEnabled: false,
        userId: user.id,
      }),
      usageRecordsFixture({ count: 1, kind: "conversation", seconds: 600, userId: user.id }),
      // Another learner's call time never counts.
      usageRecordsFixture({ count: 1, kind: "conversation", seconds: 900, userId: free.user.id }),
    ]);

    const rule = getUsageRule({ kind: "conversation", tier: "plus" });
    mockSession(user.id);
    const asked = await answering(goal.id);

    await expect(lookUp(asked, { what: "account" })).resolves.toStrictEqual({
      callMinutesLeft: {
        thisMonth: ((rule.monthSeconds ?? 0) - 600) / 60,
        today: ((rule.daySeconds ?? 0) - 600) / 60,
      },
      link: { kind: "page", page: "settings" },
      memory: { enabled: false, link: { kind: "page", page: "memory" } },
      plan: { link: { kind: "page", page: "subscription" }, tier: "plus" },
      preferences: {
        buddyName: "Pip",
        dailyLimitMinutes: 45,
        link: { kind: "page", page: "appearance" },
        sounds: false,
      },
      status: "found",
      what: "account",
    });

    // The account's pages are the whole account's, linked in any conversation.
    mockSession(free.user.id);
    const freeAsked = await answering(free.goal.id);

    await expect(lookUp(freeAsked, { what: "account" })).resolves.toMatchObject({
      link: { kind: "page", page: "settings" },
      memory: { enabled: true },
      plan: { link: { kind: "page", page: "subscription" }, tier: "free" },
      preferences: { buddyName: null, dailyLimitMinutes: null, sounds: true },
    });
  });

  it("tells the week as the logbook does, against the week before, with the biggest step", async () => {
    const [{ goal, user }, other] = await Promise.all([learnerWithGoal(), userFixture()]);
    const asked = await answering(goal.id);
    const skill = await skillFixture({ name: `Proportions ${randomUUID()}` });

    // The week of Sep 28 to Oct 4, read on its Sunday, when the logbook is ready.
    const monday = new Date("2026-09-28T00:00:00Z");

    const day = (offset: number, hour = 0) =>
      new Date(monday.getTime() + offset * MS_PER_DAY + hour * 3_600_000);

    await Promise.all([
      dailyProgressFixtureMany([
        {
          correctAnswers: 20,
          date: day(0),
          incorrectAnswers: 5,
          timeSpentSeconds: 2700,
          userId: user.id,
        },
        {
          correctAnswers: 10,
          date: day(2),
          incorrectAnswers: 2,
          timeSpentSeconds: 1500,
          userId: user.id,
        },
        { correctAnswers: 10, date: day(-3), timeSpentSeconds: 1800, userId: user.id },
        { correctAnswers: 500, date: day(1), timeSpentSeconds: 30_000, userId: other.id },
      ]),
      attemptFixture({
        answeredAt: day(0, 10),
        isCorrect: false,
        skillId: skill.id,
        userId: user.id,
      }),
      attemptFixture({
        answeredAt: day(0, 11),
        isCorrect: true,
        skillId: skill.id,
        userId: user.id,
      }),
      attemptFixture({
        answeredAt: day(2, 10),
        isCorrect: true,
        skillId: skill.id,
        userId: user.id,
      }),
      attemptFixture({
        answeredAt: day(5, 10),
        isCorrect: true,
        skillId: skill.id,
        userId: user.id,
      }),
      milestoneFixture({ earnedAt: day(3, 10), userId: user.id }),
    ]);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(day(6, 18));

    try {
      await expect(lookUp(asked, { what: "weekly" })).resolves.toStrictEqual({
        badges: 1,
        biggestStep: {
          reason: "practice",
          rememberedDays: 2,
          rightFrom: 50,
          rightTo: 100,
          skill: skill.name,
        },
        lastWeek: { averageMinutes: 30, daysStudied: 1, minutes: 30, questions: 10 },
        link: { kind: "page", page: "logbook" },
        next: null,
        phasesFinished: [],
        status: "found",
        week: {
          averageMinutes: 35,
          daysStudied: 2,
          end: "2026-10-04",
          finished: true,
          minutes: 70,
          questions: 37,
          start: "2026-09-28",
        },
        what: "weekly",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("lists the courses the learner studies with their progress, bounded, never another's", async () => {
    const [{ goal, user }, other] = await Promise.all([learnerWithGoal(), userFixture()]);

    const catalog = await Promise.all(
      Array.from({ length: 7 }, (_, index) =>
        catalogCourseFixture({ lessonCounts: [2], title: `Course ${index} ${randomUUID()}` }),
      ),
    );

    const [studied, ...rest] = catalog;
    const theirs = rest.pop();

    if (!studied || !theirs) {
      throw new Error("Expected catalog courses");
    }

    await Promise.all([
      prisma.goal.update({ data: { primaryCourseId: studied.course.id }, where: { id: goal.id } }),
      learningEventFixture({
        contentIds: { chapterId: studied.chapters[0]?.id, lessonId: studied.lessons[0]?.[0]?.id },
        userId: user.id,
      }),
      ...rest.map((course, index) =>
        learningEventFixture({
          contentIds: { chapterId: course.chapters[0]?.id, lessonId: randomUUID() },
          endedAt: new Date(Date.now() - (index + 1) * 3_600_000),
          userId: user.id,
        }),
      ),
      learningEventFixture({
        contentIds: { chapterId: theirs.chapters[0]?.id, lessonId: theirs.lessons[0]?.[0]?.id },
        userId: other.id,
      }),
    ]);

    const asked = await answering(goal.id);
    const result = await lookUp(asked, { what: "courses" });

    expect(result).toMatchObject({
      link: { kind: "page", page: "courses" },
      moreCourses: 1,
      status: "found",
      what: "courses",
    });

    if (result.status !== "found" || result.what !== "courses") {
      throw new Error(`Expected courses, received ${result.status}`);
    }

    expect(result.courses).toHaveLength(5);

    expect(result.courses[0]).toStrictEqual({
      lessonsDone: 1,
      percentDone: 50,
      thisGoal: true,
      title: studied.course.title,
    });

    expect(JSON.stringify(result)).not.toContain(theirs.course.title);

    // A course's words narrow it to that course.
    await expect(
      lookUp(asked, { query: studied.course.title, what: "courses" }),
    ).resolves.toMatchObject({ courses: [{ title: studied.course.title }], moreCourses: 0 });
  });

  it("finds a course by a short name, and a short name it doesn't have finds none", async () => {
    const { goal, user } = await learnerWithGoal();

    const [go, math] = await Promise.all([
      catalogCourseFixture({ lessonCounts: [1], title: `Go basics ${randomUUID()}` }),
      catalogCourseFixture({ lessonCounts: [1], title: `Mathematics ${randomUUID()}` }),
    ]);

    await Promise.all(
      [go, math].map((studied) =>
        learningEventFixture({
          contentIds: { chapterId: studied.chapters[0]?.id, lessonId: studied.lessons[0]?.[0]?.id },
          userId: user.id,
        }),
      ),
    );

    const asked = await answering(goal.id);

    await expect(lookUp(asked, { query: "Go", what: "courses" })).resolves.toMatchObject({
      courses: [{ title: go.course.title }],
      moreCourses: 0,
    });

    await expect(lookUp(asked, { query: "AI", what: "courses" })).resolves.toStrictEqual({
      status: "notFound",
      what: "courses",
    });
  });

  it("finds no courses for a learner who studies none", async () => {
    const { goal } = await learnerWithGoal();
    const asked = await answering(goal.id);

    await expect(lookUp(asked, { what: "courses" })).resolves.toStrictEqual({
      status: "notFound",
      what: "courses",
    });
  });

  it("reads progress toward the goal: preparation, what's still needed by area and open mistakes", async () => {
    const [{ goal, library, user }, other] = await Promise.all([plannedLearner(), userFixture()]);
    const [math, biology] = library.skills;

    if (!math || !biology) {
      throw new Error("Expected planned skills");
    }

    await Promise.all([
      mistakeFixture({ skillId: math.id, userId: user.id }),
      mistakeFixture({ skillId: math.id, status: "fixed", userId: user.id }),
      mistakeFixture({ skillId: math.id, userId: other.id }),
    ]);

    mockSession(user.id);
    const asked = await answering(goal.id);

    await expect(lookUp(asked, { what: "progress" })).resolves.toStrictEqual({
      language: null,
      link: { kind: "page", page: "plan" },
      mistakes: { link: { kind: "page", page: "mistakes" }, open: 1 },
      preparation: {
        estimatedScore: null,
        percent: expect.any(Number),
        planStatus: expect.any(String),
        stage: "starting",
        weakestArea: null,
        weekGain: expect.any(Number),
      },
      status: "found",
      stillNeeded: {
        areas: [
          {
            minutes: expect.any(Number),
            skills: [math.name],
            skillsLeft: 1,
            skillsTotal: 1,
            title: "Math chapter 1",
          },
          {
            minutes: expect.any(Number),
            skills: [biology.name],
            skillsLeft: 1,
            skillsTotal: 1,
            title: "Biology chapter 2",
          },
        ],
        minutes: expect.any(Number),
        moreAreas: 0,
        skillsLeft: 2,
      },
      what: "progress",
    });

    // One area asked: what's still needed counts that area alone, never the whole goal.
    const mathOnly = await lookUp(asked, { area: "math", what: "progress" });

    if (mathOnly.status !== "found" || mathOnly.what !== "progress") {
      throw new Error(`Expected Math's progress, received ${mathOnly.status}`);
    }

    const [mathArea] = mathOnly.stillNeeded?.areas ?? [];

    expect(mathOnly.stillNeeded).toStrictEqual({
      areas: [expect.objectContaining({ title: "Math chapter 1" })],
      minutes: mathArea?.minutes,
      moreAreas: 0,
      skillsLeft: 1,
    });

    // An area the goal doesn't have says which ones it has.
    await expect(lookUp(asked, { area: "Chemistry", what: "progress" })).resolves.toStrictEqual({
      areas: ["Math chapter 1", "Biology chapter 2"],
      moreAreas: 0,
      status: "notFound",
      what: "progress",
    });
  });

  it("links progress to the stats, not the open goal's pages, when this goal isn't the one open", async () => {
    const { goal } = await plannedLearner({ open: false });
    const asked = await answering(goal.id);

    await expect(lookUp(asked, { what: "progress" })).resolves.toMatchObject({
      link: { kind: "page", page: "stats" },
      mistakes: { link: null, open: 0 },
      status: "found",
    });
  });
});

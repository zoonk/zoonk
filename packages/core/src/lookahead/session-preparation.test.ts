import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  heldBackDraftFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { describe, expect, it, vi } from "vitest";
import { mockGuestSession, mockSession } from "../_test-utils/mock-session";
import { addDays } from "../plans/planner/plan-calendar";
import {
  getGoalPreparationAccess,
  getSessionPreparationAccess,
  listSessionPreparation,
} from "./session-preparation";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

const TIME_ZONE = "UTC";

function today() {
  return getDateInTimeZone({ date: new Date(), timeZone: TIME_ZONE });
}

/** Two chapters of one course band: the learner studies the first; the second has no specs yet. */
async function courseWithTwoChapters() {
  const [course, first, second] = await Promise.all([
    courseFixture(),
    libraryChapterFixture(),
    libraryChapterFixture(),
  ]);

  await Promise.all([
    courseChapterFixture({ chapterId: first.id, courseId: course.id, position: 0 }),
    courseChapterFixture({ chapterId: second.id, courseId: course.id, position: 1 }),
  ]);

  const [studied, nextChapterLesson, plannedNextChapterLesson] = await Promise.all([
    libraryLessonFixture({ homeChapterId: first.id }),
    libraryLessonFixture({ homeChapterId: second.id }),
    libraryLessonFixture({ homeChapterId: second.id, specStatus: "completed" }),
  ]);

  await Promise.all([
    chapterLessonFixture({ chapterId: first.id, lessonId: studied.id, position: 0 }),
    chapterLessonFixture({ chapterId: second.id, lessonId: nextChapterLesson.id, position: 0 }),
    chapterLessonFixture({
      chapterId: second.id,
      lessonId: plannedNextChapterLesson.id,
      position: 1,
    }),
  ]);

  return { nextChapterLesson, studied };
}

/**
 * How many lessons a learner gets written ahead on a day of six lessons with four planned tomorrow,
 * and whether today's come in session order.
 */
async function prepareSixLessonDay(userId: string) {
  const goal = await goalFixture({ userId });

  const [plan, session, todayLessons, tomorrowLessons] = await Promise.all([
    planFixture({ goalId: goal.id }),
    studySessionFixture({ goalId: goal.id, localDate: today(), userId }),
    Promise.all(Array.from({ length: 6 }, () => libraryLessonFixture())),
    Promise.all(Array.from({ length: 4 }, () => libraryLessonFixture())),
  ]);

  await Promise.all([
    ...todayLessons.map((lesson, position) =>
      studySessionBlockFixture({ lessonId: lesson.id, position, sessionId: session.id }),
    ),
    ...tomorrowLessons.map((lesson, position) =>
      planItemFixture({
        lessonId: lesson.id,
        planId: plan.id,
        position,
        scheduledFor: addDays(today(), 1),
      }),
    ),
  ]);

  const result = await listSessionPreparation({ goalId: goal.id, timeZone: TIME_ZONE, userId });

  return {
    later: result.laterLessonIds.length,
    today: result.lessonIds.length,
    writesInOrder:
      JSON.stringify(result.lessonIds) ===
      JSON.stringify(todayLessons.slice(0, result.lessonIds.length).map((lesson) => lesson.id)),
  };
}

describe(getSessionPreparationAccess, () => {
  it("prepares the owner's sessions, ended ones included, and skips guests and other learners", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);
    const goal = await goalFixture({ timezone: "America/Sao_Paulo", userId: owner.id });

    const [running, ended] = await Promise.all([
      studySessionFixture({ goalId: goal.id, localDate: today(), userId: owner.id }),
      studySessionFixture({
        goalId: goal.id,
        localDate: addDays(today(), -1),
        status: "completed",
        userId: owner.id,
      }),
    ]);

    mockSession(owner.id);

    await expect(getSessionPreparationAccess({ sessionId: running.id })).resolves.toStrictEqual({
      goalId: goal.id,
      sessionId: running.id,
      status: "ready",
      timeZone: "America/Sao_Paulo",
      userId: owner.id,
    });

    // A session that ended still prepares the next one.
    await expect(getSessionPreparationAccess({ sessionId: ended.id })).resolves.toMatchObject({
      status: "ready",
    });

    mockSession(other.id);

    await expect(getSessionPreparationAccess({ sessionId: running.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    await prisma.user.update({ data: { isAnonymous: true }, where: { id: owner.id } });
    mockGuestSession(owner.id);

    await expect(getSessionPreparationAccess({ sessionId: running.id })).resolves.toStrictEqual({
      lessonId: null,
      status: "guest",
    });
  });

  it("names only the lesson a guest reaches next, the first learn block still to do", async () => {
    const guest = await userFixture();

    const [goal] = await Promise.all([
      goalFixture({ userId: guest.id }),
      prisma.user.update({ data: { isAnonymous: true }, where: { id: guest.id } }),
    ]);

    const [session, done, next, later] = await Promise.all([
      studySessionFixture({ goalId: goal.id, localDate: today(), userId: guest.id }),
      libraryLessonFixture({ contentStatus: "completed" }),
      libraryLessonFixture(),
      libraryLessonFixture(),
    ]);

    await Promise.all([
      studySessionBlockFixture({
        lessonId: done.id,
        position: 0,
        sessionId: session.id,
        status: "completed",
      }),
      studySessionBlockFixture({ kind: "review", position: 1, sessionId: session.id }),
      studySessionBlockFixture({ lessonId: next.id, position: 2, sessionId: session.id }),
      studySessionBlockFixture({ lessonId: later.id, position: 3, sessionId: session.id }),
    ]);

    mockGuestSession(guest.id);

    await expect(getSessionPreparationAccess({ sessionId: session.id })).resolves.toStrictEqual({
      lessonId: next.id,
      status: "guest",
    });
  });
});

/** A plan for the goal with one unwritten lesson tomorrow. */
async function planTomorrowLesson(goalId: string) {
  const [plan, lesson] = await Promise.all([planFixture({ goalId }), libraryLessonFixture()]);

  await planItemFixture({
    lessonId: lesson.id,
    planId: plan.id,
    scheduledFor: addDays(today(), 1),
  });
}

describe(listSessionPreparation, () => {
  it("lists this session's next lessons and the next study day's first one, not the next chapter's specs", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });

    const [plan, { studied }] = await Promise.all([
      planFixture({ goalId: goal.id }),
      courseWithTwoChapters(),
    ]);

    const [written, tomorrow, later] = await Promise.all([
      libraryLessonFixture({ contentStatus: "completed" }),
      libraryLessonFixture(),
      libraryLessonFixture(),
    ]);

    const session = await studySessionFixture({
      goalId: goal.id,
      localDate: today(),
      userId: user.id,
    });

    await Promise.all([
      studySessionBlockFixture({
        kind: "learn",
        lessonId: studied.id,
        position: 0,
        sessionId: session.id,
      }),
      studySessionBlockFixture({
        kind: "learn",
        lessonId: written.id,
        position: 1,
        sessionId: session.id,
      }),
      studySessionBlockFixture({ kind: "review", position: 2, sessionId: session.id }),
      planItemFixture({
        lessonId: tomorrow.id,
        planId: plan.id,
        position: 0,
        scheduledFor: addDays(today(), 1),
      }),
      planItemFixture({
        lessonId: later.id,
        planId: plan.id,
        position: 1,
        scheduledFor: addDays(today(), 3),
      }),
    ]);

    const result = await listSessionPreparation({
      goalId: goal.id,
      timeZone: TIME_ZONE,
      userId: user.id,
    });

    // Today's are minutes away; tomorrow's first is written in the background. Each lesson plans
    // its chapter's specs when it's written, so no spec is written for a chapter nobody reached.
    expect(result).toMatchObject({ laterLessonIds: [tomorrow.id], lessonIds: [studied.id] });

    // The written one too: the learner's field and tool versions are made from written lessons.
    expect(result.plannedLessonIds).toStrictEqual([studied.id, written.id, tomorrow.id]);
  });

  it("writes more ahead for a Plus subscriber than for a free learner", async () => {
    const [free, plus] = await Promise.all([userFixture(), userFixture()]);

    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: plus.id, status: "active" },
    });

    // The lesson the learner is in and the next ones of today, and tomorrow's first ones.
    await expect(prepareSixLessonDay(free.id)).resolves.toStrictEqual({
      later: 1,
      today: 3,
      writesInOrder: true,
    });

    await expect(prepareSixLessonDay(plus.id)).resolves.toStrictEqual({
      later: 3,
      today: 5,
      writesInOrder: true,
    });
  });

  it("writes today's lessons from the one the learner is in, in session order", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });

    const [session, playing, next, later] = await Promise.all([
      studySessionFixture({ goalId: goal.id, localDate: today(), userId: user.id }),
      libraryLessonFixture({ contentStatus: "completed" }),
      libraryLessonFixture(),
      libraryLessonFixture(),
    ]);

    await Promise.all(
      [playing, later, next].map((lesson, index) =>
        studySessionBlockFixture({
          kind: "learn",
          lessonId: lesson.id,
          // The session plays `playing`, then `next`, then `later`, whatever order they were added in.
          position: [0, 2, 1][index],
          sessionId: session.id,
          status: index === 0 ? "active" : "pending",
        }),
      ),
    );

    await expect(
      listSessionPreparation({ goalId: goal.id, timeZone: TIME_ZONE, userId: user.id }),
    ).resolves.toMatchObject({ lessonIds: [next.id, later.id] });
  });

  it("prepares the study day after the lessons today's session already pulled ahead", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });

    const [plan, session, pulledAhead, dayAfter] = await Promise.all([
      planFixture({ goalId: goal.id }),
      studySessionFixture({ goalId: goal.id, localDate: today(), userId: user.id }),
      libraryLessonFixture({ contentStatus: "completed" }),
      libraryLessonFixture(),
    ]);

    // Today's session filled its time with tomorrow's lesson, which is being played now.
    await Promise.all([
      studySessionBlockFixture({
        kind: "learn",
        lessonId: pulledAhead.id,
        position: 0,
        sessionId: session.id,
        status: "active",
      }),
      planItemFixture({
        lessonId: pulledAhead.id,
        planId: plan.id,
        position: 0,
        scheduledFor: addDays(today(), 1),
      }),
      planItemFixture({
        lessonId: dayAfter.id,
        planId: plan.id,
        position: 1,
        scheduledFor: addDays(today(), 2),
      }),
    ]);

    const result = await listSessionPreparation({
      goalId: goal.id,
      timeZone: TIME_ZONE,
      userId: user.id,
    });

    expect(result).toMatchObject({ laterLessonIds: [dayAfter.id], lessonIds: [] });
  });

  it("drafts again a planned lesson its checks held back while it has drafts left", async () => {
    const user = await userFixture();

    // A Plus subscriber gets three of the next study day's lessons written ahead.
    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    });

    const goal = await goalFixture({ userId: user.id });
    const plan = await planFixture({ goalId: goal.id });

    const [heldBack, setAside, stopped] = await Promise.all([
      libraryLessonFixture({ contentStatus: "failed", heldBackDrafts: [heldBackDraftFixture()] }),
      libraryLessonFixture({
        contentStatus: "failed",
        heldBackDrafts: [heldBackDraftFixture(), heldBackDraftFixture(), heldBackDraftFixture()],
        setAsideAt: new Date(),
      }),
      libraryLessonFixture({ contentStatus: "failed" }),
    ]);

    await Promise.all(
      [heldBack, setAside, stopped].map((lesson, position) =>
        planItemFixture({
          lessonId: lesson.id,
          planId: plan.id,
          position,
          scheduledFor: addDays(today(), 1),
        }),
      ),
    );

    const result = await listSessionPreparation({
      goalId: goal.id,
      timeZone: TIME_ZONE,
      userId: user.id,
    });

    // A run that just stopped is retried when the learner opens the lesson; a set-aside one never.
    expect(result.laterLessonIds).toStrictEqual([heldBack.id]);
  });

  it("says whether the learner has a personal layer to write over the planned lessons", async () => {
    const [nurse, analyst, plain] = await Promise.all([
      userFixture(),
      userFixture(),
      userFixture(),
    ]);

    const [nurseGoal, analystGoal, plainGoal] = await Promise.all([
      goalFixture({ details: { purpose: "work", role: "ICU nurse" }, userId: nurse.id }),
      goalFixture({ userId: analyst.id }),
      goalFixture({ userId: plain.id }),
    ]);

    await Promise.all(
      [nurseGoal, analystGoal, plainGoal].map((goal) => planTomorrowLesson(goal.id)),
    );

    // Learning without installing the spreadsheet gets hands-on screens as examples.
    await prisma.plan.update({
      data: { settings: { tools: [{ choice: "none", name: "Excel" }] } },
      where: { goalId: analystGoal.id },
    });

    const learners = [
      { goalId: nurseGoal.id, userId: nurse.id },
      { goalId: analystGoal.id, userId: analyst.id },
      { goalId: plainGoal.id, userId: plain.id },
    ];

    const personalized = await Promise.all(
      learners.map(async (learner) => {
        const result = await listSessionPreparation({ ...learner, timeZone: TIME_ZONE });
        return result.personalized;
      }),
    );

    expect(personalized).toStrictEqual([true, true, false]);
  });

  it("marks an exam goal's lessons for the reasoning check, as lessons written on demand get", async () => {
    const user = await userFixture();

    const [exam, learn] = await Promise.all([
      goalFixture({ kind: "exam", userId: user.id }),
      goalFixture({ kind: "learn", userId: user.id }),
    ]);

    const list = (goalId: string) =>
      listSessionPreparation({ goalId, timeZone: TIME_ZONE, userId: user.id });

    await expect(list(exam.id)).resolves.toMatchObject({ forExam: true });
    await expect(list(learn.id)).resolves.toMatchObject({ forExam: false });
  });

  it("prepares Day 1 from the plan before its session is built, as right after placement", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });
    const plan = await planFixture({ goalId: goal.id });

    const [written, first, second, third, tomorrow] = await Promise.all([
      libraryLessonFixture({ contentStatus: "completed" }),
      libraryLessonFixture(),
      libraryLessonFixture(),
      libraryLessonFixture(),
      libraryLessonFixture(),
    ]);

    await Promise.all([
      ...[written, first, second, third].map((lesson, position) =>
        planItemFixture({ lessonId: lesson.id, planId: plan.id, position, scheduledFor: today() }),
      ),
      planItemFixture({
        lessonId: tomorrow.id,
        planId: plan.id,
        position: 4,
        scheduledFor: addDays(today(), 1),
      }),
    ]);

    // No session yet: today's first lessons, in plan order, as many as a free learner gets ahead.
    await expect(
      listSessionPreparation({ goalId: goal.id, timeZone: TIME_ZONE, userId: user.id }),
    ).resolves.toMatchObject({
      laterLessonIds: [tomorrow.id],
      lessonIds: [first.id, second.id],
      plannedLessonIds: [written.id, first.id, second.id, tomorrow.id],
    });
  });

  it("lets only the goal's owner prepare it with no session open, and a guest only its first lesson", async () => {
    const [owner, other, guest] = await Promise.all([userFixture(), userFixture(), userFixture()]);

    const [goal, guestGoal] = await Promise.all([
      goalFixture({ timezone: "America/Sao_Paulo", userId: owner.id }),
      goalFixture({ userId: guest.id }),
    ]);

    const [guestPlan, firstLesson] = await Promise.all([
      planFixture({ goalId: guestGoal.id }),
      libraryLessonFixture(),
      prisma.user.update({ data: { isAnonymous: true }, where: { id: guest.id } }),
    ]);

    await planItemFixture({ lessonId: firstLesson.id, planId: guestPlan.id, position: 0 });

    mockSession(owner.id);

    await expect(getGoalPreparationAccess({ goalId: goal.id })).resolves.toStrictEqual({
      goalId: goal.id,
      status: "ready",
      timeZone: "America/Sao_Paulo",
      userId: owner.id,
    });

    mockSession(other.id);

    await expect(getGoalPreparationAccess({ goalId: goal.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    mockGuestSession(guest.id);

    await expect(getGoalPreparationAccess({ goalId: guestGoal.id })).resolves.toStrictEqual({
      lessonId: firstLesson.id,
      status: "guest",
    });
  });

  it("prepares nothing for a paused goal", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ status: "paused", userId: user.id });

    await expect(
      listSessionPreparation({ goalId: goal.id, timeZone: TIME_ZONE, userId: user.id }),
    ).resolves.toStrictEqual({
      forExam: false,
      laterLessonIds: [],
      lessonIds: [],
      personalized: false,
      plannedLessonIds: [],
    });
  });
});

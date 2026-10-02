import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
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
import { getSessionPreparationAccess, listSessionPreparation } from "./session-preparation";

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
  it("lists this session's and the next study day's unwritten lessons, and the next chapter's unplanned ones", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });

    const [plan, { nextChapterLesson, studied }] = await Promise.all([
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

    expect(result.lessonIds.toSorted()).toStrictEqual([studied.id, tomorrow.id].toSorted());

    // The written one too: the learner's field and tool versions are made from written lessons.
    expect(result.plannedLessonIds.toSorted()).toStrictEqual(
      [studied.id, written.id, tomorrow.id].toSorted(),
    );

    expect(result.specLessonIds).toStrictEqual([nextChapterLesson.id]);
  });

  it("leaves a next-chapter lesson it writes now out of the chapter's specs, so it plans its own", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });

    const [plan, session, { nextChapterLesson, studied }] = await Promise.all([
      planFixture({ goalId: goal.id }),
      studySessionFixture({ goalId: goal.id, localDate: today(), userId: user.id }),
      courseWithTwoChapters(),
    ]);

    await Promise.all([
      studySessionBlockFixture({ lessonId: studied.id, position: 0, sessionId: session.id }),
      planItemFixture({
        lessonId: nextChapterLesson.id,
        planId: plan.id,
        scheduledFor: addDays(today(), 1),
      }),
    ]);

    const result = await listSessionPreparation({
      goalId: goal.id,
      timeZone: TIME_ZONE,
      userId: user.id,
    });

    expect(result.lessonIds.toSorted()).toStrictEqual(
      [studied.id, nextChapterLesson.id].toSorted(),
    );

    expect(result.specLessonIds).toStrictEqual([]);
  });

  it("marks today's next unwritten lesson as urgent, in session order", async () => {
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
    ).resolves.toMatchObject({ urgentLessonId: next.id });
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

    expect(result.lessonIds).toStrictEqual([dayAfter.id]);
  });

  it("drafts again a planned lesson its checks held back while it has drafts left", async () => {
    const user = await userFixture();
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
    expect(result.lessonIds).toStrictEqual([heldBack.id]);
  });

  it("says whether the learner has a personal layer to write over the planned lessons", async () => {
    const [nurse, deeper, plain] = await Promise.all([userFixture(), userFixture(), userFixture()]);

    const [nurseGoal, deeperGoal, plainGoal] = await Promise.all([
      goalFixture({ details: { purpose: "work", role: "ICU nurse" }, userId: nurse.id }),
      goalFixture({ userId: deeper.id }),
      goalFixture({ userId: plain.id }),
      learningProfileFixture({ deeperByDefault: true, userId: deeper.id }),
    ]);

    await Promise.all(
      [nurseGoal, deeperGoal, plainGoal].map((goal) => planTomorrowLesson(goal.id)),
    );

    const learners = [
      { goalId: nurseGoal.id, userId: nurse.id },
      { goalId: deeperGoal.id, userId: deeper.id },
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

  it("prepares nothing for a paused goal", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ status: "paused", userId: user.id });

    await expect(
      listSessionPreparation({ goalId: goal.id, timeZone: TIME_ZONE, userId: user.id }),
    ).resolves.toStrictEqual({
      forExam: false,
      lessonIds: [],
      personalized: false,
      plannedLessonIds: [],
      specLessonIds: [],
      urgentLessonId: null,
    });
  });
});

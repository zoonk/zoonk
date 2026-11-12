import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  type LessonAttrs,
  chapterLessonFixture,
  heldBackDraftFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { scopeIdentityKey } from "@zoonk/utils/identity-key";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { describe, expect, it } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { mockGuestSession, mockSession } from "../_test-utils/mock-session";
import { addDays } from "../plans/planner/plan-calendar";
import {
  getGoalPreparationAccess,
  getSessionPreparationAccess,
  listSessionPreparation,
} from "./session-preparation";
import { createPlanGenerationManifest } from "./speculative-lessons";

const TIME_ZONE = "UTC";

function today() {
  return getDateInTimeZone({ date: new Date(), timeZone: TIME_ZONE });
}

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
  it("prepares nothing for a free exam plan past its first week, while Plus keeps preparing", async () => {
    const [free, plus] = await Promise.all([userFixture(), userFixture()]);

    const [freeGoal, plusGoal] = await Promise.all(
      [free, plus].map((user) =>
        goalFixture({ createdAt: addDays(new Date(), -10), kind: "exam", userId: user.id }),
      ),
    );

    const [freeSession, plusSession] = await Promise.all([
      studySessionFixture({ goalId: freeGoal?.id, localDate: today(), userId: free.id }),
      studySessionFixture({ goalId: plusGoal?.id, localDate: today(), userId: plus.id }),
      prisma.subscription.create({
        data: { plan: "plus", provider: "zoonk", referenceId: plus.id, status: "active" },
      }),
    ]);

    mockSession(free.id);

    await expect(getSessionPreparationAccess({ sessionId: freeSession.id })).resolves.toStrictEqual(
      { status: "plusRequired" },
    );

    await expect(getGoalPreparationAccess({ goalId: freeGoal?.id ?? "" })).resolves.toStrictEqual({
      status: "plusRequired",
    });

    mockSession(plus.id);

    await expect(getSessionPreparationAccess({ sessionId: plusSession.id })).resolves.toMatchObject(
      { status: "ready" },
    );
  });

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
      goalId: goal.id,
      lessonId: null,
      status: "guest",
      userId: owner.id,
    });
  });

  it("names only the lesson a guest reaches next, the first learn block not started yet", async () => {
    const guest = await userFixture();

    const [goal] = await Promise.all([
      goalFixture({ userId: guest.id }),
      prisma.user.update({ data: { isAnonymous: true }, where: { id: guest.id } }),
    ]);

    const [session, done, current, next, later] = await Promise.all([
      studySessionFixture({ goalId: goal.id, localDate: today(), userId: guest.id }),
      libraryLessonFixture({ contentStatus: "completed" }),
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
      studySessionBlockFixture({
        lessonId: current.id,
        position: 1,
        sessionId: session.id,
        status: "active",
      }),
      studySessionBlockFixture({ kind: "review", position: 2, sessionId: session.id }),
      studySessionBlockFixture({ lessonId: next.id, position: 3, sessionId: session.id }),
      studySessionBlockFixture({ lessonId: later.id, position: 4, sessionId: session.id }),
    ]);

    mockGuestSession(guest.id);

    await expect(getSessionPreparationAccess({ sessionId: session.id })).resolves.toStrictEqual({
      goalId: goal.id,
      lessonId: next.id,
      status: "guest",
      userId: guest.id,
    });
  });
});

async function planTomorrowLesson(goalId: string) {
  const [plan, lesson] = await Promise.all([planFixture({ goalId }), libraryLessonFixture()]);

  await planItemFixture({
    lessonId: lesson.id,
    planId: plan.id,
    scheduledFor: addDays(today(), 1),
  });
}

async function chapterWithChallenge(attrs: LessonAttrs = {}) {
  const chapter = await libraryChapterFixture();

  const [first, challenge] = await Promise.all([
    libraryLessonFixture({ homeChapterId: chapter.id }),
    libraryLessonFixture({
      homeChapterId: chapter.id,
      identityKey: scopeIdentityKey({
        key: `challenge:${chapter.id}`,
        ownerId: attrs.ownerId ?? null,
      }),
      ...attrs,
    }),
  ]);

  return { challenge, first };
}

async function chapterPreparationPlan() {
  const user = await userFixture();
  const goal = await goalFixture({ details: { placementDeclined: true }, userId: user.id });
  const plan = await planFixture({ goalId: goal.id });

  const list = () =>
    listSessionPreparation({ goalId: goal.id, timeZone: TIME_ZONE, userId: user.id });

  return { goal, list, plan, user };
}

describe(listSessionPreparation, () => {
  it("prepares challenges from today's and next day's chapters at the immediate tier only once", async () => {
    const { list, plan } = await chapterPreparationPlan();

    const [current, next, outside] = await Promise.all([
      chapterWithChallenge(),
      chapterWithChallenge(),
      chapterWithChallenge(),
    ]);

    await Promise.all([
      planItemFixture({
        lessonId: current.first.id,
        planId: plan.id,
        position: 0,
        scheduledFor: today(),
      }),
      planItemFixture({
        lessonId: current.challenge.id,
        planId: plan.id,
        position: 1,
        scheduledFor: null,
      }),
      planItemFixture({
        lessonId: next.first.id,
        planId: plan.id,
        position: 2,
        scheduledFor: addDays(today(), 1),
      }),
      planItemFixture({
        lessonId: next.challenge.id,
        planId: plan.id,
        position: 3,
        scheduledFor: addDays(today(), 2),
      }),
      planItemFixture({
        lessonId: outside.first.id,
        planId: plan.id,
        position: 4,
        scheduledFor: addDays(today(), 3),
      }),
      planItemFixture({
        lessonId: outside.challenge.id,
        planId: plan.id,
        position: 5,
        scheduledFor: addDays(today(), 3),
      }),
    ]);

    await expect(list()).resolves.toMatchObject({
      laterLessonIds: [next.first.id],
      lessonIds: [current.first.id, current.challenge.id, next.challenge.id],
      plannedLessonIds: [current.first.id, current.challenge.id, next.challenge.id, next.first.id],
    });
  });

  it("promotes a challenge already in the next-day window without listing it twice", async () => {
    const { list, plan } = await chapterPreparationPlan();
    const { first, challenge } = await chapterWithChallenge();

    await Promise.all([
      planItemFixture({ lessonId: first.id, planId: plan.id, position: 0, scheduledFor: today() }),
      planItemFixture({
        lessonId: challenge.id,
        planId: plan.id,
        position: 1,
        scheduledFor: addDays(today(), 1),
      }),
    ]);

    await expect(list()).resolves.toMatchObject({
      laterLessonIds: [],
      lessonIds: [first.id, challenge.id],
      plannedLessonIds: [first.id, challenge.id],
    });
  });

  it.each([
    { contentStatus: "completed" as const },
    {
      contentStatus: "failed" as const,
      heldBackDrafts: [heldBackDraftFixture()],
      setAsideAt: new Date(),
    },
    { contentRunId: "already-writing-challenge", contentStatus: "running" as const },
  ])("does not restart a challenge with state %j", async (attrs) => {
    const { list, plan } = await chapterPreparationPlan();
    const { first, challenge } = await chapterWithChallenge(attrs);

    await Promise.all([
      planItemFixture({ lessonId: first.id, planId: plan.id, position: 0, scheduledFor: today() }),
      planItemFixture({ lessonId: challenge.id, planId: plan.id, position: 1, scheduledFor: null }),
    ]);

    const result = await list();
    expect(result.lessonIds).toStrictEqual([first.id]);
    expect(result.plannedLessonIds.includes(challenge.id)).toBe(attrs.setAsideAt === undefined);
  });

  it("requires current plan membership and visibility, allowing the learner's own private challenge", async () => {
    const { goal, list, plan, user } = await chapterPreparationPlan();
    const other = await userFixture();

    const [own, hidden, unplanned] = await Promise.all([
      chapterWithChallenge({ ownerId: user.id, visibility: "private" }),
      chapterWithChallenge({ ownerId: other.id, visibility: "private" }),
      chapterWithChallenge(),
    ]);

    await Promise.all([
      ...[own, hidden, unplanned].map(({ first }, position) =>
        planItemFixture({ lessonId: first.id, planId: plan.id, position, scheduledFor: today() }),
      ),
      ...[own, hidden].map(({ challenge }, position) =>
        planItemFixture({
          lessonId: challenge.id,
          planId: plan.id,
          position: position + 3,
          scheduledFor: null,
        }),
      ),
    ]);

    const result = await list();

    expect(result.lessonIds).toStrictEqual([
      own.first.id,
      hidden.first.id,
      unplanned.first.id,
      own.challenge.id,
    ]);

    const manifest = await createPlanGenerationManifest({
      goalId: goal.id,
      lessonIds: result.lessonIds,
    });

    expect(manifest?.targets.map((target) => target.lessonId)).toStrictEqual(result.lessonIds);

    await prisma.planItem.updateMany({
      data: { status: "skipped" },
      where: { lessonId: own.challenge.id, planId: plan.id },
    });

    const changed = await createPlanGenerationManifest({
      goalId: goal.id,
      lessonIds: [own.challenge.id],
    });

    expect(changed?.targets).toStrictEqual([]);

    await expect(
      listSessionPreparation({ goalId: goal.id, timeZone: TIME_ZONE, userId: other.id }),
    ).resolves.toMatchObject({ lessonIds: [], plannedLessonIds: [] });
  });

  it("keeps private challenges behind placement admission and gives guests no additional writing", async () => {
    const { goal, list, plan, user } = await chapterPreparationPlan();

    const { first, challenge } = await chapterWithChallenge({
      ownerId: user.id,
      visibility: "private",
    });

    await Promise.all([
      planItemFixture({ lessonId: first.id, planId: plan.id, position: 0, scheduledFor: today() }),
      planItemFixture({ lessonId: challenge.id, planId: plan.id, position: 1, scheduledFor: null }),
      prisma.goal.update({ data: { details: {} }, where: { id: goal.id } }),
    ]);

    const preparation = await list();

    const manifest = await createPlanGenerationManifest({
      goalId: goal.id,
      lessonIds: preparation.lessonIds,
    });

    expect(manifest?.targets.map((target) => target.lessonId)).toStrictEqual([first.id]);
    await prisma.user.update({ data: { isAnonymous: true }, where: { id: user.id } });

    await expect(list()).resolves.toMatchObject({
      laterLessonIds: [],
      lessonIds: [],
      plannedLessonIds: [],
    });

    mockGuestSession(user.id);

    await expect(getGoalPreparationAccess({ goalId: goal.id })).resolves.toMatchObject({
      lessonId: first.id,
      status: "guest",
    });
  });

  it("lists this session's next lessons and the next study day's first one, not the next chapter's specs", async () => {
    freezeClock();

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

    expect(result).toMatchObject({ laterLessonIds: [tomorrow.id], lessonIds: [studied.id] });

    expect(result.plannedLessonIds).toStrictEqual([studied.id, written.id, tomorrow.id]);
  });

  it("writes more ahead for a Plus subscriber than for a free learner", async () => {
    freezeClock();

    const [free, plus] = await Promise.all([userFixture(), userFixture()]);

    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: plus.id, status: "active" },
    });

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
      goalId: guestGoal.id,
      lessonId: firstLesson.id,
      status: "guest",
      userId: guest.id,
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

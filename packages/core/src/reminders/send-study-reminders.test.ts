import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { mockAccountSession, mockSession } from "../_test-utils/mock-session";
import { followGoalTimeZone } from "../learner/follow-goal-time-zone";
import { keepPaceOwn } from "../plans/_test-utils/keep-pace-own";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { openTodayView } from "../sessions/_test-utils/open-today-view";
import { turnOffStudyReminderEmail } from "./email-unsubscribe";
import {
  claimStudyReminder,
  listDueStudyReminders,
  readStudyReminderDelivery,
} from "./send-study-reminders";

const TODAY = new Date("2026-10-07T00:00:00Z");
const AT_SEVEN_TEN = new Date("2026-10-07T19:10:00Z");
const MINUTE_MS = 60_000;
const GOAL_CREATED_AT = new Date("2026-10-01T12:00:00Z");

/** Today's claim for a 19:00 reminder in UTC. */
const CLAIM = { endsAt: new Date("2026-10-07T20:00:00Z"), localDate: TODAY };

async function learnerWithReminder({
  dailyMinutes = 30,
  pushToken,
  time = "19:00",
  timezone = "UTC",
}: { dailyMinutes?: number; pushToken?: string; time?: string; timezone?: string } = {}) {
  const user = await userFixture();

  const pushSession = pushToken
    ? await prisma.session.create({
        data: { expiresAt: new Date("2099-01-01"), token: randomUUID(), userId: user.id },
      })
    : null;

  const goal = await goalFixture({
    createdAt: GOAL_CREATED_AT,
    dailyMinutes,
    timezone,
    title: "Italian",
    userId: user.id,
  });

  await Promise.all([
    planFixture({ goalId: goal.id }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    prisma.studyReminder.create({
      data: {
        emailOn: true,
        enabledAt: new Date(AT_SEVEN_TEN.getTime() - 24 * 60 * MINUTE_MS),
        locale: "pt",
        ...(pushToken && {
          pushLabel: "Phone",
          pushOn: true,
          pushPlatform: "android" as const,
          pushSessionId: pushSession?.id,
          pushToken,
        }),
        time,
        userId: user.id,
      },
    }),
  ]);

  return { goal, pushSession, user };
}

describe("claiming a study reminder", () => {
  it("claims a due learner's day once and marks it processed", async () => {
    const { user } = await learnerWithReminder();

    await expect(claimStudyReminder({ now: AT_SEVEN_TEN, userId: user.id })).resolves.toStrictEqual(
      { ...CLAIM, status: "claimed" },
    );

    await expect(claimStudyReminder({ now: AT_SEVEN_TEN, userId: user.id })).resolves.toMatchObject(
      { status: "notDue" },
    );

    await expect(
      prisma.studyReminder.findUniqueOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ processedOn: TODAY });
  });

  it("lets one of two concurrent claims win", async () => {
    const { user } = await learnerWithReminder();
    const claim = () => claimStudyReminder({ now: AT_SEVEN_TEN, userId: user.id });

    const results = await Promise.all([claim(), claim()]);

    expect(results.map((result) => result.status).toSorted()).toStrictEqual(["claimed", "notDue"]);
  });

  it("waits outside the hour after the reminder's time", async () => {
    const { user } = await learnerWithReminder();

    const early = new Date("2026-10-07T18:59:00Z");
    const late = new Date("2026-10-07T20:00:00Z");

    await expect(claimStudyReminder({ now: early, userId: user.id })).resolves.toMatchObject({
      status: "notDue",
    });

    await expect(claimStudyReminder({ now: late, userId: user.id })).resolves.toMatchObject({
      status: "notDue",
    });
  });

  it("skips the day once the goal's session stopped for today", async () => {
    const { goal, user } = await learnerWithReminder();

    await studySessionFixture({
      goalId: goal.id,
      localDate: TODAY,
      stoppedAt: new Date("2026-10-07T18:00:00Z"),
      userId: user.id,
    });

    await expect(claimStudyReminder({ now: AT_SEVEN_TEN, userId: user.id })).resolves.toMatchObject(
      { status: "skipped" },
    );

    await expect(
      prisma.studyReminder.findUniqueOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ processedOn: TODAY });
  });

  it("defers while the learner is studying, without marking the day", async () => {
    const { goal, user } = await learnerWithReminder();

    const session = await studySessionFixture({
      goalId: goal.id,
      localDate: TODAY,
      userId: user.id,
    });

    await studySessionBlockFixture({
      estimatedMinutes: 10,
      sessionId: session.id,
      startedAt: new Date(AT_SEVEN_TEN.getTime() - 10 * MINUTE_MS),
    });

    await expect(claimStudyReminder({ now: AT_SEVEN_TEN, userId: user.id })).resolves.toMatchObject(
      { status: "deferred" },
    );

    await expect(
      prisma.studyReminder.findUniqueOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ processedOn: null });
  });
});

describe("finding due study reminders", () => {
  it("lists rows inside their window in the active goal's zone, and reads unknown zones as UTC", async () => {
    const [due, processed, tokyo, unknownZone] = await Promise.all([
      learnerWithReminder(),
      learnerWithReminder(),
      learnerWithReminder({ timezone: "Asia/Tokyo" }),
      learnerWithReminder({ timezone: "Mars/Olympus_Mons" }),
    ]);

    await prisma.studyReminder.update({
      data: { processedOn: TODAY },
      where: { userId: processed.user.id },
    });

    const listed = await listDueStudyReminders(AT_SEVEN_TEN);

    expect(listed).toContain(due.user.id);
    expect(listed).toContain(unknownZone.user.id);
    expect(listed).not.toContain(processed.user.id);
    expect(listed).not.toContain(tokyo.user.id);
  });

  it.each([
    ["asia/tokyo", "2026-10-07T10:10:00Z"],
    ["+01:00", "2026-10-07T18:10:00Z"],
  ])("reads %s the way the claim does", async (timezone, at) => {
    const { user } = await learnerWithReminder({ timezone });
    const now = new Date(at);

    await expect(listDueStudyReminders(now)).resolves.toContain(user.id);

    await expect(claimStudyReminder({ now, userId: user.id })).resolves.toMatchObject({
      status: "claimed",
    });
  });
});

describe("reading a study reminder's delivery", () => {
  it.each(["deleted", "expired", "unbound"] as const)(
    "never lists, claims or delivers push with a %s session",
    async (state) => {
      const { pushSession, user } = await learnerWithReminder({ pushToken: `fid-${randomUUID()}` });
      await prisma.studyReminder.update({ data: { emailOn: false }, where: { userId: user.id } });
      expect(pushSession).not.toBeNull();

      await expect(
        readStudyReminderDelivery({
          channel: "push",
          claim: CLAIM,
          now: AT_SEVEN_TEN,
          userId: user.id,
        }),
      ).resolves.toMatchObject({ channel: "push" });

      if (state === "deleted") {
        await prisma.session.delete({ where: { id: pushSession!.id } });
      } else if (state === "expired") {
        await prisma.session.update({
          data: { expiresAt: AT_SEVEN_TEN },
          where: { id: pushSession!.id },
        });
      } else {
        await prisma.studyReminder.update({
          data: { pushSessionId: null },
          where: { userId: user.id },
        });
      }

      await expect(listDueStudyReminders(AT_SEVEN_TEN)).resolves.not.toContain(user.id);

      await expect(
        claimStudyReminder({ now: AT_SEVEN_TEN, userId: user.id }),
      ).resolves.toStrictEqual({ status: "notDue" });

      await expect(
        readStudyReminderDelivery({
          channel: "push",
          claim: CLAIM,
          now: AT_SEVEN_TEN,
          userId: user.id,
        }),
      ).resolves.toBeNull();

      await prisma.studyReminder.update({ data: { emailOn: true }, where: { userId: user.id } });
      await expect(listDueStudyReminders(AT_SEVEN_TEN)).resolves.toContain(user.id);

      await expect(
        readStudyReminderDelivery({
          channel: "email",
          claim: CLAIM,
          now: AT_SEVEN_TEN,
          userId: user.id,
        }),
      ).resolves.toMatchObject({ channel: "email" });
    },
  );

  it("names the goal with work left, minutes left and the window's end, with a working unsubscribe token", async () => {
    const { goal, user } = await learnerWithReminder();

    const session = await studySessionFixture({
      goalId: goal.id,
      localDate: TODAY,
      plannedMinutes: 30,
      userId: user.id,
    });

    await studySessionBlockFixture({
      completedAt: new Date("2026-10-07T08:00:00Z"),
      estimatedMinutes: 10,
      position: 0,
      sessionId: session.id,
      status: "completed",
    });

    await studySessionBlockFixture({
      estimatedMinutes: 20,
      position: 1,
      sessionId: session.id,
      status: "pending",
    });

    const delivery = await readStudyReminderDelivery({
      channel: "email",
      claim: CLAIM,
      now: AT_SEVEN_TEN,
      userId: user.id,
    });

    expect(delivery).toMatchObject({
      address: user.email,
      channel: "email",
      expiresAt: new Date("2026-10-07T20:00:00Z"),
      locale: "pt",
      message: { goalId: goal.id, goalTitle: "Italian", minutesDone: 10, minutesLeft: 20 },
    });

    await expect(
      turnOffStudyReminderEmail(delivery?.channel === "email" ? delivery.unsubscribeToken : ""),
    ).resolves.toBe("off");
  });

  it("reads the selected phone for push, and nothing once the goal is done", async () => {
    const token = `fid-${randomUUID()}`;
    const { goal, user } = await learnerWithReminder({ dailyMinutes: 10, pushToken: token });

    await expect(
      readStudyReminderDelivery({
        channel: "push",
        claim: CLAIM,
        now: AT_SEVEN_TEN,
        userId: user.id,
      }),
    ).resolves.toMatchObject({ channel: "push", platform: "android", token });

    const session = await studySessionFixture({
      goalId: goal.id,
      localDate: TODAY,
      userId: user.id,
    });

    await studySessionBlockFixture({
      estimatedMinutes: 10,
      sessionId: session.id,
      status: "completed",
    });

    await expect(
      readStudyReminderDelivery({
        channel: "push",
        claim: CLAIM,
        now: AT_SEVEN_TEN,
        userId: user.id,
      }),
    ).resolves.toBeNull();
  });

  it("sends nothing once the learner started studying after the claim, as on a retried send", async () => {
    const { goal, user } = await learnerWithReminder();

    const session = await studySessionFixture({
      goalId: goal.id,
      localDate: TODAY,
      userId: user.id,
    });

    await studySessionBlockFixture({
      estimatedMinutes: 10,
      sessionId: session.id,
      startedAt: new Date(AT_SEVEN_TEN.getTime() - MINUTE_MS),
    });

    await expect(
      readStudyReminderDelivery({
        channel: "email",
        claim: CLAIM,
        now: AT_SEVEN_TEN,
        userId: user.id,
      }),
    ).resolves.toBeNull();
  });
});

describe("before a plan's first day", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("doesn't remind after moving west across the date line puts the learner on the day before", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-08T05:10:00Z"));

    const user = await userFixture();
    mockAccountSession({ user });

    const goal = await goalFixture({
      createdAt: new Date("2026-10-08T05:00:00Z"),
      timezone: "Pacific/Kiritimati",
      userId: user.id,
    });

    await Promise.all([
      planFixture({ goalId: goal.id, settings: { startDate: "2026-10-08" } }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
      prisma.studyReminder.create({
        data: {
          emailOn: true,
          enabledAt: new Date("2026-10-06T12:00:00Z"),
          locale: "en",
          time: "19:00",
          userId: user.id,
        },
      }),
    ]);

    await expect(
      followGoalTimeZone({ goalId: goal.id, timeZone: "Pacific/Honolulu" }),
    ).resolves.toMatchObject({ moved: true, status: "ready" });

    const delivery = await readStudyReminderDelivery({
      channel: "email",
      claim: {
        endsAt: new Date("2026-10-08T06:00:00Z"),
        localDate: new Date("2026-10-07T00:00:00Z"),
      },
      now: new Date(),
      userId: user.id,
    });

    const claim = await claimStudyReminder({ now: new Date(), userId: user.id });

    expect({ claim, delivery }).toStrictEqual({ claim: { status: "skipped" }, delivery: null });
  });
});

describe("a day holding time for lessons not written yet", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("still reminds with the time Today shows left", async () => {
    const now = new Date("2026-09-30T12:10:00Z");
    const anHourAgo = new Date(now.getTime() - 60 * MINUTE_MS);
    freezeClock();
    vi.setSystemTime(now);
    await keepPaceOwn();

    const [user, course, library] = await Promise.all([
      userFixture(),
      courseFixture({ outlineStatus: "running" }),
      planLibraryFixture({ skills: [{ lessons: 2 }, { lessons: 0, size: 20 }] }),
    ]);

    const { goal } = await unplannedGoalFixture({
      dailyMinutes: 30,
      details: { placementDeclined: true },
      primaryCourseId: course.id,
      settings: { startDate: "2026-09-30" },
      timezone: "UTC",
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    mockSession(user.id);

    const opened = await openTodayView({ goalId: goal.id, timeZone: "UTC" });

    await Promise.all([
      prisma.studySessionBlock.updateMany({
        data: { completedAt: anHourAgo, status: "completed" },
        where: { sessionId: opened.today.session.id },
      }),
      prisma.planItem.updateMany({
        data: { completedAt: anHourAgo, status: "done" },
        where: {
          lessonId: { not: null },
          plan: { goalId: goal.id },
          scheduledFor: { lte: new Date("2026-09-30") },
        },
      }),
      prisma.studyReminder.create({
        data: { emailOn: true, locale: "en", time: "12:00", userId: user.id },
      }),
    ]);

    await expect(
      readStudyReminderDelivery({
        channel: "email",
        claim: { endsAt: new Date("2026-09-30T13:00:00Z"), localDate: new Date("2026-09-30") },
        now,
        userId: user.id,
      }),
    ).resolves.toMatchObject({ message: { goalId: goal.id, minutesLeft: 24 } });
  });
});

import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { writeSeedV2 } from "@zoonk/db/seed/v2";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { scopeIdentityKey } from "@zoonk/utils/identity-key";
import { isJsonObject } from "@zoonk/utils/json";
import { getDateInTimeZone, getHourInTimeZone } from "@zoonk/utils/time-zone";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { clonePersona, createPersona } from "./personas";
import { findTestLearners, removeTestLearner } from "./test-learners";

const NOVEMBER = 10;
const SUNDAY = 0;

/** Days from a calendar day, as `@db.Date` columns store it, to today in the goal's time zone. */
function daysBefore(day: Date, timeZone: string): number {
  return Math.round(
    (getDateInTimeZone({ date: new Date(), timeZone }).getTime() - day.getTime()) / MS_PER_DAY,
  );
}

/** Days from an instant to today, on the calendar of the goal's time zone. */
function daysAgo(date: Date, timeZone: string): number {
  return daysBefore(getDateInTimeZone({ date, timeZone }), timeZone);
}

/** Exercise both sides of São Paulo midnight without faking database or network timers. */
async function atStudyClocks(check: () => Promise<void>): Promise<void> {
  vi.useFakeTimers({ toFake: ["Date"] });

  try {
    vi.setSystemTime(new Date("2026-10-18T02:30:00Z"));
    await check();
    vi.setSystemTime(new Date("2026-10-18T03:30:00Z"));
    await check();
  } finally {
    vi.useRealTimers();
  }
}

type LoadedPersona = Awaited<ReturnType<typeof loadPersona>>;

/** Days before today the persona's sessions are on: those it finished, and the one it left open. */
function listSessionDays(persona: LoadedPersona, timeZone: string) {
  const days = (status: "finished" | "open") =>
    persona.studySessions
      .filter((session) => (session.status === "completed") === (status === "finished"))
      .map((session) => daysBefore(session.localDate, timeZone))
      .toSorted((first, second) => first - second);

  return { finished: days("finished"), open: days("open") };
}

/** Days before today the persona studied, by its ledger, which its past sessions follow. */
function listStudyDays(persona: LoadedPersona, timeZone: string) {
  const days = persona.learningEvents.map((event) => daysBefore(event.localDate, timeZone));
  return [...new Set(days)].filter((day) => day > 0).toSorted((first, second) => first - second);
}

async function loadPersona(userId: string) {
  return prisma.user.findUniqueOrThrow({
    include: {
      attempts: true,
      goals: { include: { plan: { include: { items: true } } } },
      learnerSkills: true,
      learningEvents: true,
      mistakes: true,
      progress: true,
      studySessions: true,
    },
    where: { id: userId },
  });
}

function getGoal(persona: Awaited<ReturnType<typeof loadPersona>>) {
  const [goal] = persona.goals;

  if (!goal?.plan) {
    throw new Error(`${persona.email} has no goal with a plan`);
  }

  return { ...goal, plan: goal.plan, timeZone: goal.timezone ?? "UTC" };
}

/** A seeded persona's copy as an onboarding pass would leave it, with a lesson only they have. */
async function createSource() {
  const { email, userId } = await createPersona({ name: "pedro" });
  const key = `own-lesson-${randomUUID()}`;

  const lesson = await libraryLessonFixture({
    identityKey: scopeIdentityKey({ key, ownerId: userId }),
    ownerId: userId,
    visibility: "private",
  });

  const item = await prisma.planItem.findFirstOrThrow({
    orderBy: { position: "asc" },
    where: { kind: "lesson", plan: { goal: { userId } } },
  });

  await prisma.planItem.update({ data: { lessonId: lesson.id }, where: { id: item.id } });

  return { email, key, lesson, userId };
}

async function loadPlan(userId: string) {
  const goal = await prisma.goal.findFirstOrThrow({
    include: { plan: { include: { changes: true, items: { orderBy: { position: "asc" } } } } },
    where: { userId },
  });

  const sessions = await prisma.studySession.findMany({
    include: { blocks: { orderBy: { position: "asc" } } },
    orderBy: { localDate: "asc" },
    where: { userId },
  });

  if (!goal.plan) {
    throw new Error(`${userId} has no plan`);
  }

  return { goal, plan: goal.plan, sessions, timeZone: goal.timezone ?? "UTC" };
}

type LoadedPlan = Awaited<ReturnType<typeof loadPlan>>;

/** The hour the learner made their goal, on their own clock. */
function getLocalHour({ goal, timeZone }: LoadedPlan) {
  return getHourInTimeZone({ date: goal.createdAt, timeZone });
}

function getWeekdayMinutes({ plan }: LoadedPlan) {
  return isJsonObject(plan.settings) ? plan.settings.weekdayMinutes : null;
}

/** The plan and sessions as the learner sees them, with their dates `days` days later. */
function describePlan(
  { plan, sessions }: LoadedPlan,
  {
    days = 0,
    lessonIds = new Map(),
  }: { days?: number; lessonIds?: ReadonlyMap<string, unknown> } = {},
) {
  const later = (date: Date | null) => date && new Date(date.getTime() + days * MS_PER_DAY);
  const lesson = (id: string | null) => (id && lessonIds.get(id)) ?? id;

  return {
    items: plan.items.map((item) => ({
      kind: item.kind,
      lessonId: lesson(item.lessonId),
      position: item.position,
      scheduledFor: later(item.scheduledFor),
      status: item.status,
      title: item.titleSnapshot,
    })),
    sessions: sessions.map((session) => ({
      blocks: session.blocks.map((block) => ({
        kind: block.kind,
        lessonId: lesson(block.lessonId),
        status: block.status,
      })),
      localDate: later(session.localDate),
      status: session.status,
    })),
  };
}

describe("persona command", () => {
  // Copies point at the seeded Library and personas; each copy gets its own plan, so the seeded
  // personas' plans (\`seedV2\`) aren't needed.
  beforeAll(async () => {
    await writeSeedV2(prisma);
  }, 120_000);

  describe(createPersona, () => {
    it("rewinds a persona to the day its plan was made, before anything after placement", () =>
      atStudyClocks(async () => {
        const { email, userId } = await createPersona({ day: 1, name: "ana" });
        const persona = await loadPersona(userId);
        const goal = getGoal(persona);

        expect(email).toMatch(/^persona-ana-[\da-f]{6}@zoonk\.test$/u);
        expect(daysAgo(goal.createdAt, goal.timeZone)).toBe(0);

        // Her exam keeps a real date: the first Enem day, a Sunday in November.
        expect(goal.targetDate?.getUTCMonth()).toBe(NOVEMBER);
        expect(goal.targetDate?.getUTCDay()).toBe(SUNDAY);

        // Placement's answers stay; lessons, mocks, mistakes, belts and today's session come later.
        expect(
          persona.attempts.map((attempt) => daysAgo(attempt.answeredAt, goal.timeZone)),
        ).toStrictEqual([0, 0, 0, 0]);

        expect(persona.attempts.every((attempt) => attempt.answeredAt <= new Date())).toBe(true);

        expect(goal.plan.items.filter((item) => item.status !== "todo")).toStrictEqual([]);
        expect(persona.mistakes).toStrictEqual([]);
        expect(persona.learningEvents).toStrictEqual([]);
        expect(persona.studySessions).toStrictEqual([]);
      }));

    it("starts the plan earlier, filling the extra days with the persona's usual history", async () => {
      const { userId } = await createPersona({ day: 30, name: "pedro" });
      const persona = await loadPersona(userId);
      const goal = getGoal(persona);

      const oldestStudy = Math.max(
        ...persona.learningEvents.flatMap((event) =>
          event.endedAt ? [daysAgo(event.endedAt, goal.timeZone)] : [],
        ),
      );

      expect(daysAgo(goal.createdAt, goal.timeZone)).toBe(29);
      expect(oldestStudy).toBeGreaterThan(20);

      // Today's session, and a finished one on each day of his history.
      expect(listSessionDays(persona, goal.timeZone)).toStrictEqual({
        finished: listStudyDays(persona, goal.timeZone),
        open: [0],
      });
    });

    it("moves the persona into the past when it's been away, so it comes back to missed days", () =>
      atStudyClocks(async () => {
        const { userId } = await createPersona({ awayDays: 5, name: "lucas" });
        const persona = await loadPersona(userId);
        const goal = getGoal(persona);

        // He was in the middle of that day's session when he stopped coming.
        const newestStudy = Math.min(
          ...persona.studySessions.flatMap((session) =>
            session.startedAt ? [daysAgo(session.startedAt, goal.timeZone)] : [],
          ),
        );

        // Lucas is on day 19 of his plan when he last studies.
        expect(daysAgo(goal.createdAt, goal.timeZone)).toBe(18 + 5);

        expect(listSessionDays(persona, goal.timeZone)).toStrictEqual({
          finished: listStudyDays(persona, goal.timeZone).filter((day) => day > 5),
          open: [5],
        });

        expect(newestStudy).toBe(5);
        expect(daysAgo(persona.progress?.lastActiveAt ?? new Date(), goal.timeZone)).toBe(5);
      }));

    it("gives the copy the plan, time zone and language asked for", async () => {
      const { userId } = await createPersona({
        language: "pt",
        name: "maya",
        plus: false,
        timeZone: "Europe/Lisbon",
      });

      const [persona, subscriptions] = await Promise.all([
        loadPersona(userId),
        prisma.subscription.count({ where: { referenceId: userId } }),
      ]);

      const goal = getGoal(persona);

      const course = await prisma.course.findUniqueOrThrow({
        where: { id: goal.primaryCourseId ?? "" },
      });

      expect(subscriptions).toBe(0);
      expect(goal.timezone).toBe("Europe/Lisbon");
      expect(goal.language).toBe("pt");
      expect(course.language).toBe("pt");
    });

    it("refuses a persona or language the seed doesn't have", async () => {
      await expect(createPersona({ name: "nobody" })).rejects.toThrow(/ana, .*maya/u);

      await expect(createPersona({ language: "en", name: "marcos" })).rejects.toThrow(
        /written in pt/u,
      );
    });

    it("leaves a copy that removing test learners takes whole, keeping the seeded persona", async () => {
      const { email, userId } = await createPersona({ day: 20, name: "maya" });
      const learners = await findTestLearners();

      expect(learners.map((learner) => learner.email)).toContain(email);

      await removeTestLearner({ email, id: userId });

      const [users, goals, attempts, events, sessions, skills, seeded] = await Promise.all([
        prisma.user.count({ where: { id: userId } }),
        prisma.goal.count({ where: { userId } }),
        prisma.attempt.count({ where: { userId } }),
        prisma.learningEvent.count({ where: { userId } }),
        prisma.studySession.count({ where: { userId } }),
        prisma.learnerSkill.count({ where: { userId } }),
        prisma.user.count({ where: { email: "v2-learn@zoonk.test" } }),
      ]);

      expect([users, goals, attempts, events, sessions, skills]).toStrictEqual([0, 0, 0, 0, 0, 0]);
      expect(seeded).toBe(1);
    });
  });

  describe(clonePersona, () => {
    it("copies a learner's plan, sessions and private lessons under ids of its own", async () => {
      const source = await createSource();
      const clone = await clonePersona({ from: source.email });

      const [original, copy, ownLesson, sourceLesson, accounts] = await Promise.all([
        loadPlan(source.userId),
        loadPlan(clone.userId),
        prisma.lesson.findFirstOrThrow({ where: { ownerId: clone.userId } }),
        prisma.lesson.findUniqueOrThrow({ where: { id: source.lesson.id } }),
        prisma.account.count({ where: { userId: clone.userId } }),
      ]);

      // An onboarding pass's copy is on the day of the learner's last change: today, here.
      expect(clone.movedDays).toBe(0);
      expect(clone.email).toMatch(/^persona-pedro-[\da-f]{6}-[\da-f]{6}@zoonk\.test$/u);

      expect(describePlan(copy)).toStrictEqual(
        describePlan(original, { lessonIds: new Map([[source.lesson.id, ownLesson.id]]) }),
      );

      expect(copy.sessions.length).toBeGreaterThan(0);
      expect(ownLesson.id).not.toBe(source.lesson.id);

      expect(ownLesson.identityKey).toBe(
        scopeIdentityKey({ key: source.key, ownerId: clone.userId }),
      );

      expect(sourceLesson.ownerId).toBe(source.userId);
      expect(accounts).toBe(0);

      // Nothing of the copy, inside JSON included, points at the source's rows.
      const sourceIds = [
        original.goal.id,
        original.plan.id,
        source.lesson.id,
        ...original.plan.items.map((item) => item.id),
        ...original.sessions.flatMap((session) => [
          session.id,
          ...session.blocks.map((block) => block.id),
        ]),
      ];

      const copied = JSON.stringify(copy);

      expect(sourceIds.filter((id) => copied.includes(id))).toStrictEqual([]);
    });

    it("moves every date of a copy that's been away, its study weekdays included", async () => {
      const source = await createSource();
      const { plan } = await loadPlan(source.userId);
      const settings = isJsonObject(plan.settings) ? plan.settings : {};

      // Pedro rests on Sundays.
      await prisma.plan.update({
        data: { settings: { ...settings, weekdayMinutes: [0, 15, 15, 15, 15, 15, 15] } },
        where: { id: plan.id },
      });

      const clone = await clonePersona({ awayDays: 3, from: source.email });

      const [original, copy, progress] = await Promise.all([
        loadPlan(source.userId),
        loadPlan(clone.userId),
        prisma.dailyProgress.findMany({ where: { userId: clone.userId } }),
      ]);

      const lessonIds = new Map([[source.lesson.id, expect.any(String)]]);

      expect(clone.movedDays).toBe(-3);

      expect(describePlan(copy, { days: 3, lessonIds })).toStrictEqual(
        describePlan(original, { lessonIds }),
      );

      expect(daysAgo(copy.goal.createdAt, copy.timeZone)).toBe(
        daysAgo(original.goal.createdAt, original.timeZone) + 3,
      );

      // Three days earlier, the day his plan rests is a Thursday.
      expect(getWeekdayMinutes(copy)).toStrictEqual([15, 15, 15, 15, 0, 15, 15]);

      expect(progress.length).toBeGreaterThan(0);

      expect(progress.filter((day) => day.dayOfWeek !== day.date.getUTCDay())).toStrictEqual([]);
    });

    it("puts a copy on a later day and refuses a day before its source's last change", async () => {
      const source = await createSource();
      const later = await clonePersona({ day: 9, from: source.email });

      // Pedro is on day 7.
      expect(later.movedDays).toBe(-2);

      await expect(clonePersona({ day: 6, from: source.email })).rejects.toThrow(/day 7 or later/u);

      await expect(clonePersona({ awayDays: 1, day: 9, from: source.email })).rejects.toThrow(
        /--day or --away/u,
      );

      await expect(clonePersona({ from: "nobody@zoonk.test" })).rejects.toThrow(/no learner/u);
    });

    it("gives a copy the plan and time zone asked for, at the same local times", async () => {
      const source = await createSource();

      const [plus, free] = await Promise.all([
        clonePersona({ awayDays: 2, from: source.email, plus: true, timeZone: "Asia/Tokyo" }),
        clonePersona({ from: source.email, plus: false }),
      ]);

      const [plusCount, freeCount, original, copy] = await Promise.all([
        prisma.subscription.count({ where: { referenceId: plus.userId, status: "active" } }),
        prisma.subscription.count({ where: { referenceId: free.userId } }),
        loadPlan(source.userId),
        loadPlan(plus.userId),
      ]);

      expect([plusCount, freeCount]).toStrictEqual([1, 0]);
      expect(copy.timeZone).toBe("Asia/Tokyo");
      expect(getLocalHour(copy)).toBe(getLocalHour(original));

      expect(daysAgo(copy.goal.createdAt, copy.timeZone)).toBe(
        daysAgo(original.goal.createdAt, original.timeZone) + 2,
      );
    });

    it("removes a copy without touching its source, and keeps onboarded sources", async () => {
      const source = await createSource();
      const clone = await clonePersona({ from: source.email });
      const before = await loadPlan(source.userId);

      await removeTestLearner({ email: clone.email, id: clone.userId });

      const [after, sourceLesson, cloneRows] = await Promise.all([
        loadPlan(source.userId),
        prisma.lesson.findUnique({ where: { id: source.lesson.id } }),
        prisma.goal.count({ where: { userId: clone.userId } }),
      ]);

      expect(after).toStrictEqual(before);
      expect(sourceLesson?.ownerId).toBe(source.userId);
      expect(cloneRows).toBe(0);

      const onboarded = await userFixture({ email: `onboarded-sofia-${randomUUID()}@zoonk.test` });
      const goal = await goalFixture({ timezone: "America/Sao_Paulo", userId: onboarded.id });
      await planFixture({ goalId: goal.id });

      const [learners, copy] = await Promise.all([
        findTestLearners(),
        clonePersona({ from: onboarded.email }),
      ]);

      expect(learners.map((learner) => learner.email)).not.toContain(onboarded.email);
      expect(copy.email).toMatch(/^persona-sofia-[\da-f-]+-[\da-f]{6}@zoonk\.test$/u);
    });
  });
});

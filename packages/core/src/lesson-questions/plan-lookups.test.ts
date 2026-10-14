import { randomUUID } from "node:crypto";
import { type GoalTutorLookUpRequest } from "@zoonk/ai/tasks/v2/tutor/goal-tutor-lookup";
import { prisma } from "@zoonk/db";
import { planChangeFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { claimLessonQuestionAnswer } from "./answer-lifecycle";
import { createLessonQuestion } from "./create-lesson-question";
import { lookUpTutorData } from "./look-up-tutor-data";

const MODEL = "openai/gpt-6-luna";

/** A Monday: the plan's week runs through Sunday, October 4. */
const NOW = new Date("2020-09-28T12:00:00Z");

const TODAY_LINK = { kind: "page", page: "today" };

type LearnerSpec = {
  /** The goal is the one the app has open, so the buddy may link what acts on it. */
  active?: boolean;
  /** Lessons earlier days left: the plan's last new-day settling carried its first ones. */
  behind?: number;
  lessons?: number;
  phases?: string[];
};

/** A learner with a built plan of Physics lessons, with each phase's lessons in its own skill. */
async function plannedLearner({
  active = true,
  behind = 0,
  lessons = 4,
  phases = ["Basics"],
}: LearnerSpec = {}) {
  const user = await userFixture();

  const library = await planLibraryFixture({
    phases,
    skills: phases.map((_, phase) => ({ area: "Physics", lessons, phase })),
  });

  const { goal } = await unplannedGoalFixture({
    dailyMinutes: 12,
    timezone: "UTC",
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });

  const plan = await prisma.plan.findUniqueOrThrow({
    include: { items: { orderBy: { position: "asc" } } },
    where: { goalId: goal.id },
  });

  const carried = plan.items.filter((item) => item.kind === "lesson").slice(0, behind);

  // Otherwise another goal is the one the app has open.
  const open = active ? { goal } : await unplannedGoalFixture({ userId: user.id });

  await Promise.all([
    carried.length > 0
      ? planChangeFixture({
          kind: "missedDays",
          payload: { carriedItemIds: carried.map((item) => item.id), days: 1, source: "system" },
          planId: plan.id,
          status: "applied",
        })
      : null,
    learningProfileFixture({ activeGoalId: open.goal.id, userId: user.id }),
  ]);

  return { carried, goal, library, plan, user };
}

/** The buddy's answer being written for the learner's question about their plan. */
async function answering({ goalId, userId }: { goalId: string; userId: string }) {
  mockSession(userId);

  const created = await createLessonQuestion({
    input: { context: { kind: "plan" }, question: "What's ahead?", requestId: randomUUID() },
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

/** What the buddy finds while it writes that answer. */
function lookUp(
  asked: { questionId: string; revision: number },
  request: Partial<GoalTutorLookUpRequest> & Pick<GoalTutorLookUpRequest, "what">,
) {
  return lookUpTutorData({ area: null, query: null, ...asked, ...request });
}

describe("the plan the buddy looks up", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    mockSession(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("catchUp", () => {
    it("lists every lesson earlier days left in the plan's order, linked to Today, and only the learner's own", async () => {
      const [learner, other] = await Promise.all([
        plannedLearner({ behind: 3 }),
        plannedLearner({ behind: 3 }),
      ]);

      const found = await lookUp(
        await answering({ goalId: learner.goal.id, userId: learner.user.id }),
        { what: "catchUp" },
      );

      expect(found).toStrictEqual({
        lessons: learner.carried.map((item) => ({
          inToday: false,
          link: TODAY_LINK,
          title: item.titleSnapshot,
        })),
        more: 0,
        offeredToday: false,
        status: "found",
        total: 3,
        what: "catchUp",
      });

      const raw = JSON.stringify(found);

      for (const item of other.carried) {
        expect(raw).not.toContain(item.titleSnapshot);
      }
    });

    it("links a lesson to today's block once the day holds it", async () => {
      const { carried, goal, user } = await plannedLearner({ behind: 2 });
      const [first] = carried;

      if (!first) {
        throw new Error("Expected a carried lesson");
      }

      const session = await studySessionFixture({
        goalId: goal.id,
        localDate: new Date("2020-09-28T00:00:00Z"),
        userId: user.id,
      });

      const block = await studySessionBlockFixture({
        kind: "learn",
        lessonId: first.lessonId,
        payload: { planItemId: first.id },
        position: 0,
        sessionId: session.id,
      });

      await expect(
        lookUp(await answering({ goalId: goal.id, userId: user.id }), { what: "catchUp" }),
      ).resolves.toMatchObject({
        lessons: [
          { inToday: true, link: { blockId: block.id, kind: "block" }, title: first.titleSnapshot },
          { inToday: false, link: TODAY_LINK },
        ],
        total: 2,
      });
    });

    it("names 30 lessons and counts the rest", async () => {
      const { carried, goal, user } = await plannedLearner({ behind: 32, lessons: 32 });

      const found = await lookUp(await answering({ goalId: goal.id, userId: user.id }), {
        what: "catchUp",
      });

      expect(found).toMatchObject({ more: 2, status: "found", total: 32 });

      expect(found.status === "found" && found.what === "catchUp" && found.lessons).toStrictEqual(
        carried
          .slice(0, 30)
          .map((item) => ({ inToday: false, link: TODAY_LINK, title: item.titleSnapshot })),
      );
    });

    it("links nothing that would open another goal's day when this goal isn't the one open", async () => {
      const { carried, goal, user } = await plannedLearner({ active: false, behind: 2 });

      await expect(
        lookUp(await answering({ goalId: goal.id, userId: user.id }), { what: "catchUp" }),
      ).resolves.toMatchObject({
        lessons: carried.map((item) => ({ inToday: false, link: null, title: item.titleSnapshot })),
      });
    });

    it("finds nothing for a learner on pace", async () => {
      const { goal, user } = await plannedLearner();

      await expect(
        lookUp(await answering({ goalId: goal.id, userId: user.id }), { what: "catchUp" }),
      ).resolves.toStrictEqual({ status: "notFound", what: "catchUp" });
    });
  });

  describe("schedule", () => {
    it("reads the plan's saved days from tomorrow through two weeks, with this week's minutes", async () => {
      const { goal, plan, user } = await plannedLearner();

      const found = await lookUp(await answering({ goalId: goal.id, userId: user.id }), {
        what: "schedule",
      });

      if (found.status !== "found" || found.what !== "schedule") {
        throw new Error(`Expected a schedule, received ${JSON.stringify(found)}`);
      }

      expect(found).toMatchObject({ from: "2020-09-29", to: "2020-10-12" });

      const saved = plan.items.filter(
        (item) =>
          item.scheduledFor &&
          item.scheduledFor >= new Date("2020-09-29") &&
          item.scheduledFor <= new Date("2020-10-12"),
      );

      expect(saved.length).toBeGreaterThan(0);

      expect(found.days.flatMap((day) => day.items.map((item) => item.title))).toStrictEqual(
        saved.map((item) => item.titleSnapshot),
      );

      const [first] = found.days;
      expect(first?.date).toBe(saved[0]?.scheduledFor?.toISOString().slice(0, 10));
      expect(first?.items[0]).toMatchObject({ kind: "lesson", link: null, status: "todo" });
      expect(first?.items[0]?.minutes).toStrictEqual(expect.any(Number));
    });

    it("reads from the day asked, lists a few items a day, and links challenges whatever goal is open", async () => {
      const [{ goal, plan, user }, other] = await Promise.all([
        plannedLearner({ active: false }),
        plannedLearner(),
      ]);

      const reviews = Array.from({ length: 10 }, (_, index) =>
        planItemFixture({
          kind: "review",
          planId: plan.id,
          position: 1000 + index,
          scheduledFor: new Date("2021-06-03"),
          titleSnapshot: `Review ${index + 1}`,
        }),
      );

      const [mock] = await Promise.all([
        planItemFixture({
          kind: "mock",
          planId: plan.id,
          position: 1100,
          scheduledFor: new Date("2021-06-05"),
          titleSnapshot: "",
        }),
        planItemFixture({
          planId: plan.id,
          position: 1101,
          scheduledFor: new Date("2021-05-31"),
          titleSnapshot: "Before the day asked",
        }),
        planItemFixture({
          planId: plan.id,
          position: 1102,
          scheduledFor: new Date("2021-06-15"),
          titleSnapshot: "After two weeks",
        }),
        planItemFixture({
          kind: "review",
          planId: other.plan.id,
          position: 1000,
          scheduledFor: new Date("2021-06-03"),
          titleSnapshot: "Another learner's review",
        }),
        ...reviews,
      ]);

      const found = await lookUp(await answering({ goalId: goal.id, userId: user.id }), {
        query: "2021-06-01",
        what: "schedule",
      });

      expect(found).toStrictEqual({
        days: [
          {
            date: "2021-06-03",
            items: Array.from({ length: 8 }, (_, index) => ({
              kind: "review",
              link: null,
              minutes: null,
              status: "todo",
              title: `Review ${index + 1}`,
            })),
            moreItems: 2,
          },
          {
            date: "2021-06-05",
            items: [
              {
                kind: "mock",
                link: { kind: "challenge", planItemId: mock.id },
                minutes: null,
                status: "todo",
                title: "",
              },
            ],
            moreItems: 0,
          },
        ],
        from: "2021-06-01",
        status: "found",
        to: "2021-06-14",
        what: "schedule",
      });
    });

    it("never reads before tomorrow, and reads from tomorrow when the day asked isn't one", async () => {
      const { goal, user } = await plannedLearner();
      const asked = await answering({ goalId: goal.id, userId: user.id });

      await expect(lookUp(asked, { query: "2020-01-01", what: "schedule" })).resolves.toMatchObject(
        { from: "2020-09-29" },
      );

      await expect(lookUp(asked, { query: "next week", what: "schedule" })).resolves.toMatchObject({
        from: "2020-09-29",
      });

      await expect(lookUp(asked, { query: "2020-02-31", what: "schedule" })).resolves.toMatchObject(
        { from: "2020-09-29" },
      );
    });

    it("names lessons still being written by their subject, never by the skill's own name", async () => {
      const { goal, library, plan, user } = await plannedLearner();
      const [skill] = library.skills;

      // A stand-in: the plan saves the skill's own name for lessons the Library hasn't outlined yet.
      await planItemFixture({
        lessons: 4,
        planId: plan.id,
        position: 1000,
        scheduledFor: new Date("2021-06-03"),
        skillId: skill?.id,
        titleSnapshot: skill?.name,
      });

      const found = await lookUp(await answering({ goalId: goal.id, userId: user.id }), {
        query: "2021-06-01",
        what: "schedule",
      });

      expect(found).toMatchObject({
        days: [
          { date: "2021-06-03", items: [{ kind: "lesson", title: "Physics", writing: true }] },
        ],
      });

      expect(JSON.stringify(found)).not.toContain(skill?.name);
    });

    it("finds nothing on days the plan has nothing", async () => {
      const { goal, user } = await plannedLearner();

      await expect(
        lookUp(await answering({ goalId: goal.id, userId: user.id }), {
          query: "2030-01-01",
          what: "schedule",
        }),
      ).resolves.toStrictEqual({ status: "notFound", what: "schedule" });
    });
  });

  describe("challenges", () => {
    it("lists every phase challenge and planned mock ahead, with how many are done", async () => {
      const [{ goal, plan, user }, other] = await Promise.all([
        plannedLearner({ active: false, phases: ["Basics", "Projects"] }),
        plannedLearner(),
      ]);

      const [ahead, otherMock] = await Promise.all([
        planItemFixture({
          kind: "mock",
          phase: 1,
          planId: plan.id,
          position: 1000,
          scheduledFor: new Date("2020-10-10"),
        }),
        planItemFixture({
          kind: "mock",
          planId: other.plan.id,
          position: 1000,
          scheduledFor: new Date("2020-10-10"),
        }),
        planItemFixture({
          kind: "mock",
          planId: plan.id,
          position: 1001,
          scheduledFor: new Date("2020-09-20"),
          status: "done",
        }),
        // Neither a mock set aside nor one with no day is ahead.
        planItemFixture({
          kind: "mock",
          planId: plan.id,
          position: 1002,
          scheduledFor: new Date("2020-10-03"),
          status: "skipped",
        }),
        planItemFixture({ kind: "mock", planId: plan.id, position: 1003 }),
      ]);

      const bosses = plan.items.filter((item) => item.kind === "boss");
      expect(bosses).toHaveLength(2);

      const found = await lookUp(await answering({ goalId: goal.id, userId: user.id }), {
        what: "challenges",
      });

      expect(found).toStrictEqual({
        challenges: [
          ...bosses.map((boss, index) => ({
            date: boss.scheduledFor?.toISOString().slice(0, 10) ?? null,
            kind: "challenge",
            link: { kind: "challenge", planItemId: boss.id },
            locked: false,
            phase: { index, kind: "learn", name: ["Basics", "Projects"][index] },
            when: expect.any(String),
          })),
          {
            date: "2020-10-10",
            kind: "mock",
            link: { kind: "challenge", planItemId: ahead.id },
            locked: false,
            phase: { index: 1, kind: "learn", name: "Projects" },
            when: "date",
          },
        ],
        done: { challenges: 0, mocks: 1 },
        status: "found",
        what: "challenges",
      });

      expect(JSON.stringify(found)).not.toContain(otherMock.id);
    });

    it("marks what a free exam plan needs Plus for: its mocks, and the days past its first week", async () => {
      const user = await userFixture();
      const library = await planLibraryFixture({ skills: [{ area: "Physics", lessons: 4 }] });

      // The free plan covers the goal's first 7 days: through Sunday, October 4.
      const { goal } = await unplannedGoalFixture({
        createdAt: NOW,
        dailyMinutes: 12,
        kind: "exam",
        timezone: "UTC",
        userId: user.id,
      });

      await createGoalPlan({ goalId: goal.id, graph: library.graph });
      const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });

      const [mock] = await Promise.all([
        planItemFixture({
          kind: "mock",
          planId: plan.id,
          position: 1000,
          scheduledFor: new Date("2020-10-03"),
        }),
        planItemFixture({
          kind: "review",
          planId: plan.id,
          position: 1001,
          scheduledFor: new Date("2020-10-05"),
        }),
      ]);

      const asked = await answering({ goalId: goal.id, userId: user.id });
      const schedule = await lookUp(asked, { what: "schedule" });

      if (schedule.status !== "found" || schedule.what !== "schedule") {
        throw new Error(`Expected a schedule, received ${JSON.stringify(schedule)}`);
      }

      const freeDay = schedule.days.find((day) => day.date === "2020-10-03");

      expect(freeDay?.plusRequired).toBeUndefined();

      expect(freeDay?.items).toContainEqual(
        expect.objectContaining({
          link: { kind: "challenge", planItemId: mock.id },
          plusRequired: true,
        }),
      );

      expect(schedule.days.find((day) => day.date === "2020-10-05")).toMatchObject({
        plusRequired: true,
      });

      await expect(lookUp(asked, { what: "challenges" })).resolves.toMatchObject({
        challenges: expect.arrayContaining([
          expect.objectContaining({
            kind: "mock",
            link: { kind: "challenge", planItemId: mock.id },
            locked: true,
          }),
        ]),
      });
    });

    it("finds nothing while the plan is still being built", async () => {
      const user = await userFixture();
      const { goal } = await unplannedGoalFixture({ userId: user.id });

      await expect(
        lookUp(await answering({ goalId: goal.id, userId: user.id }), { what: "challenges" }),
      ).resolves.toStrictEqual({ status: "notFound", what: "challenges" });
    });
  });
});

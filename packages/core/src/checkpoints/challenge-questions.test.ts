import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import {
  DAY_MS,
  SESSION_NOW,
  SESSION_TODAY,
  checkpointItemFixture,
  sessionGoalFixture,
} from "../sessions/_test-utils/session-goal";
import {
  requestChallengeQuestions,
  requestUpcomingChallengeQuestions,
} from "./challenge-questions";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

// PostHog is an external service; the mock records what would leave the server.
vi.mock("../analytics/server", () => ({ trackServerEvent: vi.fn() }));

/**
 * A goal whose first phase teaches two skills holding one question each, with its challenge
 * next: reached once both lessons are done, else on its day. A third lesson opens phase 1.
 */
async function thinChallengeSetup({
  done = true,
  scheduledFor = null,
}: { done?: boolean; scheduledFor?: Date | null } = {}) {
  const user = await userFixture();
  const fixture = await sessionGoalFixture({ itemsPerSkill: 1, lessons: 3, userId: user.id });
  const [first, second, third] = fixture.planItems;

  await Promise.all([
    prisma.planItem.update({ data: { phase: 1, position: 5 }, where: { id: third?.id } }),
    prisma.planItem.updateMany({
      data: { status: done ? "done" : "todo" },
      where: { id: { in: [first?.id ?? "", second?.id ?? ""] } },
    }),
  ]);

  const boss = await checkpointItemFixture({
    kind: "boss",
    planId: fixture.plan.id,
    position: 2,
    scheduledFor,
  });

  mockSession(user.id);

  return { ...fixture, boss, user };
}

function addQuestions({ count, skillId }: { count: number; skillId: string }) {
  return Promise.all(
    Array.from({ length: count }, () => itemFixture({ content: choiceItemContent(), skillId })),
  );
}

describe(requestChallengeQuestions, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is only the learner's own challenge", async () => {
    const { boss } = await thinChallengeSetup();

    mockSession(null);

    await expect(requestChallengeQuestions({ planItemId: boss.id })).resolves.toStrictEqual({
      status: "unauthorized",
    });

    const other = await userFixture();
    mockSession(other.id);

    await expect(requestChallengeQuestions({ planItemId: boss.id })).resolves.toStrictEqual({
      status: "notFound",
    });
  });

  it("writes what the challenge lacks of its ten questions, spread over its phase's skills", async () => {
    const { boss, goal, skills, user } = await thinChallengeSetup();

    await expect(requestChallengeQuestions({ planItemId: boss.id })).resolves.toStrictEqual({
      analytics: { distinctId: user.id, goalId: goal.id, platform: null },
      key: expect.any(String),
      quickFormat: "multipleChoice",
      status: "start",
      writes: [{ questionsPerSkill: 4, skillIds: [skills[0]?.id, skills[1]?.id], target: 5 }],
    });

    await Promise.all(
      skills.slice(0, 2).map((skill) => addQuestions({ count: 4, skillId: skill.id })),
    );

    await expect(requestChallengeQuestions({ planItemId: boss.id })).resolves.toStrictEqual({
      status: "ready",
    });
  });
});

describe(requestUpcomingChallengeQuestions, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes a reached challenge's questions now, for the learner who may open it any minute", async () => {
    const { boss, goal, skills } = await thinChallengeSetup();

    await expect(requestUpcomingChallengeQuestions({ goalId: goal.id })).resolves.toMatchObject({
      challenges: [
        {
          later: false,
          planItemId: boss.id,
          writes: [{ questionsPerSkill: 4, skillIds: [skills[0]?.id, skills[1]?.id], target: 5 }],
        },
      ],
      quickFormat: "multipleChoice",
      status: "start",
    });
  });

  it("writes a challenge's questions in the background days before it, and none for one further away", async () => {
    const soon = await thinChallengeSetup({
      done: false,
      scheduledFor: new Date(SESSION_TODAY.getTime() + 3 * DAY_MS),
    });

    await expect(
      requestUpcomingChallengeQuestions({ goalId: soon.goal.id }),
    ).resolves.toMatchObject({
      challenges: [{ later: true, planItemId: soon.boss.id }],
      status: "start",
    });

    const far = await thinChallengeSetup({
      done: false,
      scheduledFor: new Date(SESSION_TODAY.getTime() + 20 * DAY_MS),
    });

    await expect(requestUpcomingChallengeQuestions({ goalId: far.goal.id })).resolves.toStrictEqual(
      { status: "ready" },
    );
  });

  it("writes the week's mixed challenge the day before, on the skills the week studied", async () => {
    const { goal, items, plan, skills, user } = await thinChallengeSetup({
      done: false,
      scheduledFor: new Date(SESSION_TODAY.getTime() + 20 * DAY_MS),
    });

    await Promise.all(
      items
        .slice(0, 2)
        .map((item) =>
          attemptFixture({
            answeredAt: new Date(SESSION_NOW.getTime() - DAY_MS),
            itemId: item.id,
            skillId: item.skillId,
            userId: user.id,
          }),
        ),
    );

    const weekly = await checkpointItemFixture({
      kind: "checkpoint",
      planId: plan.id,
      position: 10,
      scheduledFor: new Date(SESSION_TODAY.getTime() + DAY_MS),
    });

    const request = await requestUpcomingChallengeQuestions({ goalId: goal.id });

    expect(request).toMatchObject({
      challenges: [{ later: true, planItemId: weekly.id, writes: [{ questionsPerSkill: 4 }] }],
      status: "start",
    });

    expect(
      request.status === "start" && request.challenges[0]?.writes[0]?.skillIds.toSorted(),
    ).toStrictEqual([skills[0]?.id ?? "", skills[1]?.id ?? ""].toSorted());
  });

  // The session's preparation and the learner's Start (or two tabs) asking at once: they name the
  // same run, which the later one joins, and the challenge's help is counted once.
  it("counts a challenge's writing once, however many ask for it at once", async () => {
    const { boss, goal, user } = await thinChallengeSetup();

    const requests = await Promise.all([
      requestUpcomingChallengeQuestions({ goalId: goal.id }),
      requestUpcomingChallengeQuestions({ goalId: goal.id }),
      requestChallengeQuestions({ planItemId: boss.id }),
    ]);

    const keys = requests.map((request) => {
      if (request.status !== "start") {
        throw new Error(`Expected a write, got ${request.status}`);
      }

      return "challenges" in request ? request.challenges[0]?.key : request.key;
    });

    expect(new Set(keys).size).toBe(1);

    await expect(
      prisma.usageRecord.findMany({ select: { targetId: true }, where: { userId: user.id } }),
    ).resolves.toStrictEqual([{ targetId: boss.id }]);
  });

  it("writes nothing for a challenge whose phase already holds its ten questions", async () => {
    const { goal, skills } = await thinChallengeSetup();

    await Promise.all(
      skills.slice(0, 2).map((skill) => addQuestions({ count: 4, skillId: skill.id })),
    );

    await expect(requestUpcomingChallengeQuestions({ goalId: goal.id })).resolves.toStrictEqual({
      status: "ready",
    });
  });
});

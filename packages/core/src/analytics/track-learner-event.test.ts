import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { headers } from "next/headers";
import { describe, expect, it, vi } from "vitest";
import { trackServerEvent } from "./server";
import { trackLearnerEvents } from "./track-learner-event";

// PostHog is an external service; the mock records what would leave the server.
vi.mock("./server", () => ({ trackServerEvent: vi.fn() }));

// Request headers only exist inside a Next.js request; outside one, reading them fails like this.
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => {
    throw new Error("`headers` was called outside a request scope");
  }),
}));

const APPLE_APP_USER_AGENT = "Zoonk/42 CFNetwork/3826.500.111 Darwin/25.0.0";

const EVENT = { name: "Logbook Viewed" } as const;

/** A Fun learner whose active exam goal is in its second phase, plus another goal. */
async function setup() {
  const user = await userFixture();

  const [active, other] = await Promise.all([
    goalFixture({ kind: "exam", language: "pt", userId: user.id }),
    goalFixture({ kind: "language", language: "es", userId: user.id }),
  ]);

  const plan = await planFixture({ goalId: active.id });

  await Promise.all([
    planItemFixture({ phase: 0, planId: plan.id, position: 0, status: "done" }),
    planItemFixture({ phase: 1, planId: plan.id, position: 1 }),
    learningProfileFixture({ activeGoalId: active.id, experienceMode: "fun", userId: user.id }),
  ]);

  return { active, other, user };
}

describe(trackLearnerEvents, () => {
  it("sends each event with the learner's mode and active goal's kind, phase and language", async () => {
    const { user } = await setup();

    await trackLearnerEvents({ events: [EVENT, EVENT], platform: "ios", userId: user.id });

    expect(trackServerEvent).toHaveBeenCalledTimes(2);

    expect(trackServerEvent).toHaveBeenCalledWith({
      ...EVENT,
      distinctId: user.id,
      shared: {
        goal_kind: "exam",
        is_guest: false,
        locale: "pt",
        mode: "fun",
        plan_phase: 1,
        platform: "ios",
      },
    });
  });

  it("describes the goal the event is about, and the locale the sender knows", async () => {
    const { other, user } = await setup();

    await trackLearnerEvents({ events: [EVENT], goalId: other.id, locale: "fr", userId: user.id });

    expect(trackServerEvent).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        shared: expect.objectContaining({
          goal_kind: "language",
          locale: "fr",
          mode: "fun",
          plan_phase: null,
        }),
      }),
    );
  });

  it("describes the goal the tabs show when none was picked yet", async () => {
    const { active, other, user } = await setup();

    await Promise.all([
      prisma.userLearningProfile.update({
        data: { activeGoalId: null },
        where: { userId: user.id },
      }),
      prisma.goal.update({ data: { status: "paused" }, where: { id: other.id } }),
    ]);

    await trackLearnerEvents({ events: [EVENT], userId: user.id });

    expect(trackServerEvent).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        shared: expect.objectContaining({ goal_kind: active.kind, plan_phase: 1 }),
      }),
    );
  });

  it("counts a guest without a goal or profile in Focus, the default", async () => {
    const user = await userFixture();
    await prisma.user.update({ data: { isAnonymous: true }, where: { id: user.id } });

    await trackLearnerEvents({ events: [EVENT], userId: user.id });

    expect(trackServerEvent).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        shared: {
          goal_kind: null,
          is_guest: true,
          locale: null,
          mode: "focus",
          plan_phase: null,
          platform: null,
        },
      }),
    );
  });

  it("names the client from the request when the sender doesn't say it", async () => {
    const { user } = await setup();
    vi.mocked(headers).mockResolvedValueOnce(new Headers({ "user-agent": APPLE_APP_USER_AGENT }));

    await trackLearnerEvents({ events: [EVENT], userId: user.id });

    expect(trackServerEvent).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ shared: expect.objectContaining({ platform: "ios" }) }),
    );
  });

  it("keeps the platform a workflow step carries instead of reading the request it runs in", async () => {
    const { user } = await setup();

    await trackLearnerEvents({ events: [EVENT], platform: null, userId: user.id });

    expect(headers).not.toHaveBeenCalled();

    expect(trackServerEvent).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ shared: expect.objectContaining({ platform: null }) }),
    );
  });

  it("sends nothing for someone who isn't a learner, and never fails the caller", async () => {
    await expect(
      trackLearnerEvents({ events: [EVENT], userId: randomUUID() }),
    ).resolves.toBeUndefined();

    await expect(
      trackLearnerEvents({ events: [EVENT], userId: "not-a-uuid" }),
    ).resolves.toBeUndefined();

    expect(trackServerEvent).not.toHaveBeenCalled();
  });
});

import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { headers } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { trackServerEvent } from "./server";
import { trackLearnerEvents } from "./track-learner-event";

const APPLE_APP_USER_AGENT = "Zoonk/42 CFNetwork/3826.500.111 Darwin/25.0.0";

const EVENT = { name: "Logbook Viewed" } as const;

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
    learningProfileFixture({ activeGoalId: active.id, userId: user.id }),
  ]);

  return { active, other, user };
}

describe(trackLearnerEvents, () => {
  beforeEach(() => {
    vi.mocked(headers).mockRejectedValue(new Error("`headers` was called outside a request scope"));
  });

  it("sends each event with the active goal's kind, phase and language", async () => {
    const { user } = await setup();

    await trackLearnerEvents({ events: [EVENT, EVENT], platform: "ios", userId: user.id });

    expect(trackServerEvent).toHaveBeenCalledTimes(2);

    expect(trackServerEvent).toHaveBeenCalledWith({
      ...EVENT,
      distinctId: expect.any(String),
      identified: false,
      shared: { goal_kind: "exam", is_guest: false, locale: "pt", plan_phase: 1, platform: "ios" },
    });
  });

  it("describes the goal the event is about, and the locale the sender knows", async () => {
    const { other, user } = await setup();

    await trackLearnerEvents({ events: [EVENT], goalId: other.id, locale: "fr", userId: user.id });

    expect(trackServerEvent).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        shared: expect.objectContaining({ goal_kind: "language", locale: "fr", plan_phase: null }),
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

  it("describes a guest without a goal or profile", async () => {
    const user = await userFixture();
    await prisma.user.update({ data: { isAnonymous: true }, where: { id: user.id } });

    await trackLearnerEvents({ events: [EVENT], userId: user.id });

    expect(trackServerEvent).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        shared: { goal_kind: null, is_guest: true, locale: null, plan_phase: null, platform: null },
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

  it("sends nothing once the learner turned usage data off", async () => {
    const { user } = await setup();

    await prisma.userLearningProfile.update({
      data: { shareUsageData: false },
      where: { userId: user.id },
    });

    await trackLearnerEvents({ events: [EVENT], userId: user.id });

    expect(trackServerEvent).not.toHaveBeenCalled();
  });

  it("identifies an adult where they are, and never a minor", async () => {
    const { user } = await setup();
    const year = new Date().getUTCFullYear();

    vi.mocked(headers).mockResolvedValue(new Headers({ "x-vercel-ip-country": "BR" }));

    await prisma.userLearningProfile.update({
      data: { birthYear: year - 19 },
      where: { userId: user.id },
    });

    await trackLearnerEvents({ events: [EVENT], userId: user.id });

    await prisma.userLearningProfile.update({
      data: { birthYear: year - 17 },
      where: { userId: user.id },
    });

    await trackLearnerEvents({ events: [EVENT], userId: user.id });

    expect(vi.mocked(trackServerEvent).mock.calls.map(([event]) => event.identified)).toStrictEqual(
      [true, false],
    );
  });

  it("sends an adult's events under their account, and a minor's under a random ID each time", async () => {
    const { user } = await setup();
    const year = new Date().getUTCFullYear();
    vi.mocked(headers).mockResolvedValue(new Headers({ "x-vercel-ip-country": "BR" }));

    await prisma.userLearningProfile.update({
      data: { birthYear: year - 30 },
      where: { userId: user.id },
    });

    await trackLearnerEvents({ events: [EVENT], userId: user.id });

    await prisma.userLearningProfile.update({
      data: { birthYear: year - 15 },
      where: { userId: user.id },
    });

    await trackLearnerEvents({ events: [EVENT, EVENT], userId: user.id });
    await trackLearnerEvents({ events: [EVENT], userId: user.id });

    const [adult, ...minor] = vi
      .mocked(trackServerEvent)
      .mock.calls.map(([event]) => event.distinctId);

    expect(adult).toBe(user.id);
    expect(minor).not.toContain(user.id);
    expect(minor[0]).toBe(minor[1]);
    expect(minor[2]).not.toBe(minor[0]);
  });

  it("takes Korea's adult age in a workflow step, and sends nothing about a minor there", async () => {
    const { user } = await setup();

    await prisma.userLearningProfile.update({
      data: { birthYear: new Date().getUTCFullYear() - 19 },
      where: { userId: user.id },
    });

    await trackLearnerEvents({ events: [EVENT], platform: null, userId: user.id });

    expect(trackServerEvent).not.toHaveBeenCalled();
  });

  it("sends nothing about a minor where the law needs a yes they can't give", async () => {
    const { user } = await setup();
    vi.mocked(headers).mockResolvedValue(new Headers({ "x-vercel-ip-country": "DE" }));

    await prisma.userLearningProfile.update({
      data: { birthYear: new Date().getUTCFullYear() - 15, shareUsageData: true },
      where: { userId: user.id },
    });

    await trackLearnerEvents({ events: [EVENT], userId: user.id });

    expect(trackServerEvent).not.toHaveBeenCalled();
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

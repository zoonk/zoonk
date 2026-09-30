import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { milestoneFixture } from "@zoonk/testing/fixtures/memory";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { revalidateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getLearningProfileCacheTag } from "../cache/tags";
import { getLearningProfile } from "./get-learning-profile";
import { updateLearningProfile } from "./update-learning-profile";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

async function useLearner() {
  const user = await userFixture();
  mockSession(user.id);
  return user;
}

describe(updateLearningProfile, () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("needs a session", async () => {
    await expect(updateLearningProfile({ experienceMode: "fun" })).resolves.toStrictEqual({
      status: "unauthorized",
    });
  });

  it("starts with no mode, buddy or age, only the buddy's own glasses and sounds on", async () => {
    await useLearner();

    await expect(getLearningProfile()).resolves.toStrictEqual({
      activeGoalId: null,
      ageGroup: "unknown",
      availableGlasses: ["round"],
      birth: null,
      buddy: null,
      dailyLimitMinutes: null,
      deeperByDefault: false,
      deeperFromMemory: false,
      experienceMode: null,
      soundsEnabled: true,
    });
  });

  it("opens the deeper version by choice, or from memory until the learner chooses", async () => {
    const user = await useLearner();
    await updateLearningProfile({ soundsEnabled: true });

    await prisma.userLearningProfile.update({
      data: { memoryAsksDeeper: true },
      where: { userId: user.id },
    });

    await expect(getLearningProfile()).resolves.toMatchObject({
      deeperByDefault: true,
      deeperFromMemory: true,
    });

    await expect(updateLearningProfile({ deeperByDefault: false })).resolves.toMatchObject({
      profile: { deeperByDefault: false, deeperFromMemory: false },
    });

    await expect(updateLearningProfile({ deeperByDefault: null })).resolves.toMatchObject({
      profile: { deeperByDefault: true, deeperFromMemory: true },
    });

    // With memory off, Zoonk stops using what it remembers, the depth preference included.
    await prisma.userLearningProfile.update({
      data: { memoryEnabled: false },
      where: { userId: user.id },
    });

    await expect(updateLearningProfile({ soundsEnabled: false })).resolves.toMatchObject({
      profile: { deeperByDefault: false, deeperFromMemory: false },
    });

    await expect(updateLearningProfile({ deeperByDefault: true })).resolves.toMatchObject({
      profile: { deeperByDefault: true, deeperFromMemory: false },
    });
  });

  it("turns sounds off and on without touching the mode or buddy", async () => {
    const user = await useLearner();
    await updateLearningProfile({ buddy: { kind: "otto" }, experienceMode: "fun" });

    await expect(updateLearningProfile({ soundsEnabled: false })).resolves.toMatchObject({
      profile: { buddy: { kind: "otto" }, experienceMode: "fun", soundsEnabled: false },
      status: "updated",
    });

    await expect(
      prisma.userLearningProfile.findUniqueOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ buddyKind: "otto", experienceMode: "fun", soundsEnabled: false });

    await updateLearningProfile({ soundsEnabled: true });
    await expect(getLearningProfile()).resolves.toMatchObject({ soundsEnabled: true });
  });

  it("saves mode, buddy, age and the active goal the tabs show", async () => {
    const user = await useLearner();
    const goal = await goalFixture({ userId: user.id });

    const result = await updateLearningProfile({
      activeGoalId: goal.id,
      birth: { month: 4, year: 1995 },
      buddy: { kind: "noodle", name: "Nodo" },
      experienceMode: "fun",
    });

    expect(result).toStrictEqual({
      profile: {
        activeGoalId: goal.id,
        ageGroup: "adult",
        availableGlasses: ["round"],
        birth: { month: 4, year: 1995 },
        buddy: { glasses: "round", kind: "noodle", name: "Nodo" },
        dailyLimitMinutes: null,
        deeperByDefault: false,
        deeperFromMemory: false,
        experienceMode: "fun",
        soundsEnabled: true,
      },
      status: "updated",
    });

    expect(revalidateTag).toHaveBeenCalledWith(getLearningProfileCacheTag(user.id), { expire: 0 });

    await updateLearningProfile({ experienceMode: "focus" });

    await expect(getLearningProfile()).resolves.toMatchObject({
      activeGoalId: goal.id,
      buddy: { kind: "noodle" },
      experienceMode: "focus",
    });
  });

  it("allows glasses the learner earned and refuses the others", async () => {
    const user = await useLearner();
    await milestoneFixture({ key: "star", kind: "glasses", userId: user.id });

    await expect(
      updateLearningProfile({ buddy: { glasses: "monocle", kind: "zu" } }),
    ).resolves.toStrictEqual({ status: "glassesNotEarned" });

    await expect(
      updateLearningProfile({ buddy: { glasses: "star", kind: "zu" } }),
    ).resolves.toMatchObject({
      profile: { availableGlasses: ["round", "star"], buddy: { glasses: "star", kind: "zu" } },
      status: "updated",
    });

    await expect(updateLearningProfile({ buddy: null })).resolves.toMatchObject({
      profile: { buddy: null },
    });
  });

  it("only switches to the learner's own goals that aren't archived", async () => {
    const [user, stranger] = await Promise.all([useLearner(), userFixture()]);

    const [otherGoal, archivedGoal] = await Promise.all([
      goalFixture({ userId: stranger.id }),
      goalFixture({ status: "archived", userId: user.id }),
    ]);

    await expect(updateLearningProfile({ activeGoalId: otherGoal.id })).resolves.toStrictEqual({
      status: "goalNotFound",
    });

    await expect(updateLearningProfile({ activeGoalId: archivedGoal.id })).resolves.toStrictEqual({
      status: "goalNotFound",
    });
  });

  it("deletes the account and everything in it when the age answer is under 13", async () => {
    const user = await useLearner();
    const goal = await goalFixture({ userId: user.id });

    await expect(
      updateLearningProfile({ birth: { month: 1, year: new Date().getUTCFullYear() - 10 } }),
    ).resolves.toStrictEqual({ status: "accountDeleted" });

    await expect(prisma.user.findUnique({ where: { id: user.id } })).resolves.toBeNull();
    await expect(prisma.goal.findUnique({ where: { id: goal.id } })).resolves.toBeNull();
  });
});

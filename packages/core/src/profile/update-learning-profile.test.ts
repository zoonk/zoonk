import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { milestoneFixture } from "@zoonk/testing/fixtures/memory";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { revalidateTag } from "next/cache";
import { beforeEach, describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getLearningProfileCacheTag } from "../cache/tags";
import { getLearningProfile } from "./get-learning-profile";
import { updateLearningProfile } from "./update-learning-profile";

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
    await expect(updateLearningProfile({ soundsEnabled: false })).resolves.toStrictEqual({
      status: "unauthorized",
    });
  });

  it("starts with no buddy, only the buddy's own glasses and sounds on", async () => {
    await useLearner();

    await expect(getLearningProfile()).resolves.toStrictEqual({
      activeGoalId: null,
      availableGlasses: ["round"],
      buddy: null,
      dailyLimitMinutes: null,
      soundsEnabled: true,
    });
  });

  it("turns sounds off and on without touching the buddy", async () => {
    const user = await useLearner();
    await updateLearningProfile({ buddy: { kind: "otto" } });

    await expect(updateLearningProfile({ soundsEnabled: false })).resolves.toMatchObject({
      profile: { buddy: { kind: "otto" }, soundsEnabled: false },
      status: "updated",
    });

    await expect(
      prisma.userLearningProfile.findUniqueOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ buddyKind: "otto", soundsEnabled: false });

    await updateLearningProfile({ soundsEnabled: true });
    await expect(getLearningProfile()).resolves.toMatchObject({ soundsEnabled: true });
  });

  it("saves the buddy and the active goal the tabs show", async () => {
    const user = await useLearner();
    const goal = await goalFixture({ userId: user.id });

    const result = await updateLearningProfile({
      activeGoalId: goal.id,
      buddy: { kind: "noodle", name: "Nodo" },
    });

    expect(result).toStrictEqual({
      profile: {
        activeGoalId: goal.id,
        availableGlasses: ["round"],
        buddy: { glasses: "round", kind: "noodle", name: "Nodo" },
        dailyLimitMinutes: null,
        soundsEnabled: true,
      },
      status: "updated",
    });

    expect(revalidateTag).toHaveBeenCalledWith(getLearningProfileCacheTag(user.id), { expire: 0 });

    await updateLearningProfile({ buddy: { kind: "zu" } });

    await expect(getLearningProfile()).resolves.toMatchObject({
      activeGoalId: goal.id,
      buddy: { kind: "zu", name: null },
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
});

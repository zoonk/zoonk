import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { milestoneFixture } from "@zoonk/testing/fixtures/memory";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { revalidateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockGuestSession, mockSession } from "../_test-utils/mock-session";
import { getLearningProfileCacheTag } from "../cache/tags";
import { markLearnerChanged } from "../learner/_utils/mark-learner-changed";
import { getLearningProfile } from "./get-learning-profile";
import { updateLearningProfile } from "./update-learning-profile";

async function useLearner() {
  const user = await userFixture();
  mockSession(user.id);
  return user;
}

async function planInputs(userId: string) {
  const plans = await prisma.plan.findMany({
    orderBy: { id: "asc" },
    select: { inputVersion: true },
    where: { goal: { userId } },
  });

  return plans.map((plan) => plan.inputVersion);
}

async function plannedLearner(isAnonymous = false) {
  const user = await userFixture();

  if (isAnonymous) {
    await prisma.user.update({ data: { isAnonymous: true }, where: { id: user.id } });
  }

  const goals = await Promise.all([
    goalFixture({ userId: user.id }),
    goalFixture({ userId: user.id }),
  ]);

  await Promise.all(goals.map((goal) => planFixture({ goalId: goal.id })));

  if (isAnonymous) {
    mockGuestSession(user.id);
  } else {
    mockSession(user.id);
  }

  return { goals, user };
}

async function waitForBlockedBy(holderPID: number) {
  await vi.waitFor(async () => {
    const [row] = await prisma.$queryRaw<{ blocked: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM pg_stat_activity AS backend
        WHERE ${holderPID}::int = ANY(pg_blocking_pids(backend.pid))
      ) AS blocked
    `;

    expect(row?.blocked).toBe(true);
  });
}

async function saveDuringConcurrentSoundChange({
  input,
  userId,
}: {
  input: Parameters<typeof updateLearningProfile>[0];
  userId: string;
}) {
  const locked = Promise.withResolvers<number>();
  const resume = Promise.withResolvers<null>();

  const first = prisma.$transaction(async (tx) => {
    await markLearnerChanged(tx, { userId });
    await tx.userLearningProfile.update({ data: { soundsEnabled: true }, where: { userId } });
    const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;

    locked.resolve(backend?.pid ?? 0);
    await resume.promise;
  });

  let settled: Promise<unknown> = Promise.allSettled([first]);
  let save: ReturnType<typeof updateLearningProfile> | undefined;

  void first.catch((error: unknown) => locked.reject(error));

  try {
    const pid = await locked.promise;
    save = updateLearningProfile(input);
    settled = Promise.allSettled([first, save]);
    await waitForBlockedBy(pid);
  } finally {
    resume.resolve(null);
    await settled;
  }

  await expect(first).resolves.toBeUndefined();
  await expect(save).resolves.toMatchObject({ status: "updated" });
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

  it.each([false, true])(
    "marks a learner's multi-field change once, including guests: %s",
    async (isAnonymous) => {
      const { goals, user } = await plannedLearner(isAnonymous);
      const goal = goals[0];

      if (!goal) {
        throw new Error("Missing owned goal");
      }

      await expect(
        updateLearningProfile({
          activeGoalId: goal.id,
          buddy: { kind: "otto" },
          soundsEnabled: false,
        }),
      ).resolves.toMatchObject({ status: "updated" });

      await expect(planInputs(user.id)).resolves.toStrictEqual([0, 0]);

      expect(revalidateTag).toHaveBeenCalledWith(getLearningProfileCacheTag(user.id), {
        expire: 0,
      });
    },
  );

  it("marks cosmetic changes without marking unchanged plan inputs, and rolls back repeated saves", async () => {
    const { user } = await plannedLearner();
    await learningProfileFixture({ userId: user.id });

    const input = { activeGoalId: null, buddy: { kind: "otto" as const }, soundsEnabled: false };

    await updateLearningProfile(input);
    await expect(planInputs(user.id)).resolves.toStrictEqual([0, 0]);

    const saved = await prisma.userLearningProfile.findUniqueOrThrow({
      where: { userId: user.id },
    });

    await updateLearningProfile(input);
    await expect(planInputs(user.id)).resolves.toStrictEqual([0, 0]);

    await expect(
      prisma.userLearningProfile.findUniqueOrThrow({ where: { userId: user.id } }),
    ).resolves.toStrictEqual(saved);

    expect(revalidateTag).toHaveBeenCalledOnce();
  });

  it("does not persist or mark a save that only repeats unsaved defaults", async () => {
    const { user } = await plannedLearner();

    await expect(
      updateLearningProfile({ activeGoalId: null, buddy: null, soundsEnabled: true }),
    ).resolves.toMatchObject({ status: "updated" });

    await expect(
      prisma.userLearningProfile.findUnique({ where: { userId: user.id } }),
    ).resolves.toBeNull();

    await expect(planInputs(user.id)).resolves.toStrictEqual([0, 0]);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it.each([{ expectedPlanVersion: 0 }])(
    "rechecks profile inputs after admission",
    async ({ expectedPlanVersion }) => {
      const { user } = await plannedLearner();
      await learningProfileFixture({ userId: user.id });

      await saveDuringConcurrentSoundChange({
        input: { buddy: { kind: "otto" }, soundsEnabled: true },
        userId: user.id,
      });

      await expect(planInputs(user.id)).resolves.toStrictEqual([
        expectedPlanVersion,
        expectedPlanVersion,
      ]);

      await expect(
        prisma.userLearningProfile.findUniqueOrThrow({ where: { userId: user.id } }),
      ).resolves.toMatchObject({ buddyKind: "otto", soundsEnabled: true });

      expect(revalidateTag).toHaveBeenCalledOnce();
    },
  );

  it("rolls back admission when a concurrent save already applied the requested change", async () => {
    const { user } = await plannedLearner();
    await learningProfileFixture({ userId: user.id });

    await saveDuringConcurrentSoundChange({ input: { soundsEnabled: true }, userId: user.id });

    await expect(planInputs(user.id)).resolves.toStrictEqual([0, 0]);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("serializes concurrent identical profile saves without changing plans", async () => {
    const { user } = await plannedLearner();
    await learningProfileFixture({ soundsEnabled: false, userId: user.id });

    await Promise.all([
      updateLearningProfile({ soundsEnabled: true }),
      updateLearningProfile({ soundsEnabled: true }),
    ]);

    await expect(planInputs(user.id)).resolves.toStrictEqual([0, 0]);
    expect(revalidateTag).toHaveBeenCalledOnce();
  });

  it("starts with Zu without saving a buddy choice", async () => {
    const user = await useLearner();

    await expect(getLearningProfile()).resolves.toStrictEqual({
      activeGoalId: null,
      availableGlasses: ["round"],
      buddy: { glasses: "round", kind: "zu", name: null, picked: false },
      shareUsageData: null,
      soundsEnabled: true,
    });

    await expect(
      prisma.userLearningProfile.findUnique({ where: { userId: user.id } }),
    ).resolves.toBeNull();
  });

  it("keeps the default buddy when only other settings were saved", async () => {
    await useLearner();
    await updateLearningProfile({ soundsEnabled: false });

    await expect(getLearningProfile()).resolves.toMatchObject({
      buddy: { glasses: "round", kind: "zu", name: null, picked: false },
      soundsEnabled: false,
    });
  });

  it("gives a guest the same default buddy", async () => {
    const user = await userFixture();
    await prisma.user.update({ data: { isAnonymous: true }, where: { id: user.id } });
    mockGuestSession(user.id);

    await expect(getLearningProfile()).resolves.toMatchObject({
      buddy: { glasses: "round", kind: "zu", name: null, picked: false },
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

  it("saves a guest's usage data choice without changing plan inputs", async () => {
    const { user } = await plannedLearner(true);

    await expect(updateLearningProfile({ shareUsageData: false })).resolves.toMatchObject({
      profile: { shareUsageData: false },
      status: "updated",
    });

    await expect(planInputs(user.id)).resolves.toStrictEqual([0, 0]);

    await updateLearningProfile({ shareUsageData: true });
    await expect(getLearningProfile()).resolves.toMatchObject({ shareUsageData: true });
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
        buddy: { glasses: "round", kind: "noodle", name: "Nodo", picked: true },
        shareUsageData: null,
        soundsEnabled: true,
      },
      status: "updated",
    });

    expect(revalidateTag).toHaveBeenCalledWith(getLearningProfileCacheTag(user.id), { expire: 0 });

    await expect(getLearningProfile()).resolves.toMatchObject({
      buddy: { glasses: "round", kind: "noodle", name: "Nodo", picked: true },
    });

    await updateLearningProfile({ buddy: { kind: "zu" } });

    await expect(getLearningProfile()).resolves.toMatchObject({
      activeGoalId: goal.id,
      buddy: { kind: "zu", name: null, picked: true },
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
      profile: { buddy: { glasses: "round", kind: "zu", name: null, picked: false } },
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

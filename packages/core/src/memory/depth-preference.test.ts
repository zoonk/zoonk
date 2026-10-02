import { detectDeeperPreference } from "@zoonk/ai/tasks/v2/memory/depth";
import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { refreshDepthPreferenceNow } from "./_utils/depth-preference";

// The model that reads preference notes is a paid external service.
vi.mock("@zoonk/ai/tasks/v2/memory/depth", () => ({ detectDeeperPreference: vi.fn() }));

const DAY_MS = 86_400_000;

function mockVerdict(asksDeeper: boolean) {
  vi.mocked(detectDeeperPreference).mockResolvedValueOnce({
    asksDeeper,
    probability: asksDeeper ? 0.9 : 0.1,
  } as Awaited<ReturnType<typeof detectDeeperPreference>>);
}

function profileOf(userId: string) {
  return prisma.userLearningProfile.findUniqueOrThrow({ where: { userId } });
}

describe(refreshDepthPreferenceNow, () => {
  beforeEach(() => {
    vi.mocked(detectDeeperPreference).mockReset();
  });

  it("turns the deeper version on when the active preference notes ask for it", async () => {
    const user = await userFixture();
    await learningProfileFixture({ userId: user.id });

    await memoryFactFixture({
      category: "preferences",
      statement: "Studies on the bus",
      userId: user.id,
    });

    await memoryFactFixture({
      category: "preferences",
      statement: "Prefers technical explanations",
      userId: user.id,
    });

    await Promise.all([
      memoryFactFixture({
        category: "goals",
        statement: "Wants a physics degree",
        userId: user.id,
      }),
      memoryFactFixture({
        category: "preferences",
        statement: "Deleted note",
        status: "deleted",
        userId: user.id,
      }),
      memoryFactFixture({
        category: "preferences",
        expiresAt: new Date(Date.now() - DAY_MS),
        statement: "Expired note",
        userId: user.id,
      }),
    ]);

    mockVerdict(true);

    await refreshDepthPreferenceNow(user.id);

    expect(vi.mocked(detectDeeperPreference).mock.calls[0]?.[0]).toMatchObject({
      analytics: { contentScope: "personal", distinctId: user.id },
      preferences: ["Studies on the bus", "Prefers technical explanations"],
    });

    await expect(profileOf(user.id)).resolves.toMatchObject({ memoryAsksDeeper: true });
  });

  it("turns it off without asking a model once no preference note is left", async () => {
    const user = await userFixture();
    await learningProfileFixture({ memoryAsksDeeper: true, userId: user.id });

    await refreshDepthPreferenceNow(user.id);

    expect(detectDeeperPreference).not.toHaveBeenCalled();
    await expect(profileOf(user.id)).resolves.toMatchObject({ memoryAsksDeeper: false });
  });

  it("creates no profile for a learner who has none", async () => {
    const user = await userFixture();

    await memoryFactFixture({
      category: "preferences",
      statement: "Prefers technical explanations",
      userId: user.id,
    });

    mockVerdict(true);
    await refreshDepthPreferenceNow(user.id);

    await expect(
      prisma.userLearningProfile.findUnique({ where: { userId: user.id } }),
    ).resolves.toBeNull();
  });
});

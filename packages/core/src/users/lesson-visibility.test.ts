import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { revalidateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getLessonVisibilityCacheTag } from "../cache/tags";
import { getLessonVisibility, updateLessonVisibility } from "./lesson-visibility";

vi.mock("./get-session", () => ({ getSession: vi.fn() }));

/** Creates and authenticates one fixture learner. */
async function createAuthenticatedUser() {
  const user = await userFixture();
  mockSession(user.id);
  return user;
}

describe("lesson visibility", () => {
  beforeEach(() => mockSession(null));

  describe(getLessonVisibility, () => {
    it("uses visible defaults for a guest", async () => {
      await expect(getLessonVisibility()).resolves.toStrictEqual({ hiddenLessonKinds: [] });
    });

    it("returns only the authenticated learner's canonical hidden kinds", async () => {
      const [user, otherUser] = await Promise.all([userFixture(), userFixture()]);
      mockSession(user.id);

      await Promise.all([
        prisma.userLearningProfile.create({
          data: {
            preferences: { hiddenLessonKinds: ["quiz", "unknown", "explanation", "quiz"] },
            userId: user.id,
          },
        }),
        prisma.userLearningProfile.create({
          data: { preferences: { hiddenLessonKinds: ["vocabulary"] }, userId: otherUser.id },
        }),
      ]);

      await expect(getLessonVisibility()).resolves.toStrictEqual({
        hiddenLessonKinds: ["explanation", "quiz"],
      });
    });
  });

  describe(updateLessonVisibility, () => {
    it("preserves unrelated preferences while replacing hidden kinds", async () => {
      const user = await createAuthenticatedUser();

      await prisma.userLearningProfile.create({
        data: { preferences: { existing: "value", hiddenLessonKinds: ["quiz"] }, userId: user.id },
      });

      const result = await updateLessonVisibility({
        hiddenLessonKinds: ["vocabulary", "vocabulary"],
      });

      const profile = await prisma.userLearningProfile.findUniqueOrThrow({
        where: { userId: user.id },
      });

      expect(profile.preferences).toStrictEqual({
        existing: "value",
        hiddenLessonKinds: ["vocabulary"],
      });

      expect(result).toStrictEqual({ hiddenLessonKinds: ["vocabulary"] });

      expect(revalidateTag).toHaveBeenCalledExactlyOnceWith(getLessonVisibilityCacheTag(user.id), {
        expire: 0,
      });
    });

    it("does not persist settings for a guest", async () => {
      const profileCount = await prisma.userLearningProfile.count();

      await expect(updateLessonVisibility({ hiddenLessonKinds: ["quiz"] })).resolves.toBeNull();

      await expect(prisma.userLearningProfile.count()).resolves.toBe(profileCount);
    });
  });
});

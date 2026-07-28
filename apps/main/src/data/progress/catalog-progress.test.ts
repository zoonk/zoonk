import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, describe, expect, it, vi } from "vitest";
import { signInAsCurrentUser } from "../../_test-utils/auth";
import { getCatalogLessonProgress } from "./catalog-progress";

describe(getCatalogLessonProgress, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("degrades an optional progress query failure to an empty list", async () => {
    const user = await userFixture();
    await signInAsCurrentUser({ email: user.email, password: user.password });
    vi.spyOn(prisma, "$queryRaw").mockRejectedValueOnce(new Error("Progress query failed"));

    await expect(
      getCatalogLessonProgress({ chapterId: crypto.randomUUID() }),
    ).resolves.toStrictEqual([]);
  });
});

import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getSession } from "../users/get-session";
import { correctBirthYearForSupport } from "./correct-birth-year";

const THIS_YEAR = new Date().getUTCFullYear();

function mockAdminSession(userId: string) {
  vi.mocked(getSession).mockResolvedValue(
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Only the identity and role are read.
    { user: { id: userId, role: "admin" } } as Awaited<ReturnType<typeof getSession>>,
  );
}

describe(correctBirthYearForSupport, () => {
  it("lets support replace a learner's year", async () => {
    const [admin, learner] = await Promise.all([userFixture({ role: "admin" }), userFixture()]);
    await learningProfileFixture({ birthYear: THIS_YEAR - 5, userId: learner.id });
    mockAdminSession(admin.id);

    await expect(
      correctBirthYearForSupport({ birthYear: 2001, userId: learner.id }),
    ).resolves.toStrictEqual({ status: "saved" });

    await expect(
      prisma.userLearningProfile.findUnique({ where: { userId: learner.id } }),
    ).resolves.toMatchObject({ birthYear: 2001 });
  });

  it("closes the account for a year certainly below the minimum age anywhere", async () => {
    const [admin, learner] = await Promise.all([userFixture({ role: "admin" }), userFixture()]);
    mockAdminSession(admin.id);

    await expect(
      correctBirthYearForSupport({ birthYear: THIS_YEAR - 12, userId: learner.id }),
    ).resolves.toStrictEqual({ status: "accountClosed" });

    await expect(prisma.user.findUnique({ where: { id: learner.id } })).resolves.toBeNull();
  });

  it("is for admins only", async () => {
    const learner = await userFixture();
    mockSession(learner.id);

    await expect(
      correctBirthYearForSupport({ birthYear: THIS_YEAR - 12, userId: learner.id }),
    ).resolves.toStrictEqual({ status: "forbidden" });

    await expect(prisma.user.findUnique({ where: { id: learner.id } })).resolves.not.toBeNull();
  });
});

import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { revalidateTag } from "next/cache";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getLearningProfileCacheTag } from "../cache/tags";
import { getSession } from "../users/get-session";
import { correctBirthForSupport } from "./correct-birth-for-support";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

function mockAdminSession(userId: string) {
  vi.mocked(getSession).mockResolvedValue(
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Only the identity and role are read.
    { user: { id: userId, role: "admin" } } as Awaited<ReturnType<typeof getSession>>,
  );
}

const TEEN_YEAR = new Date().getUTCFullYear() - 15;

describe(correctBirthForSupport, () => {
  it("makes a learner older when support has checked it, which the learner can't do", async () => {
    const [admin, learner] = await Promise.all([userFixture({ role: "admin" }), userFixture()]);
    await learningProfileFixture({ birthMonth: 4, birthYear: TEEN_YEAR, userId: learner.id });
    mockAdminSession(admin.id);

    await expect(
      correctBirthForSupport({ birth: { month: 4, year: 1995 }, userId: learner.id }),
    ).resolves.toStrictEqual({ status: "corrected" });

    await expect(
      prisma.userLearningProfile.findUniqueOrThrow({ where: { userId: learner.id } }),
    ).resolves.toMatchObject({ birthMonth: 4, birthYear: 1995 });

    expect(revalidateTag).toHaveBeenCalledWith(getLearningProfileCacheTag(learner.id), {
      expire: 0,
    });
  });

  it("saves an answer for a learner who never gave one", async () => {
    const [admin, learner] = await Promise.all([userFixture({ role: "admin" }), userFixture()]);
    mockAdminSession(admin.id);

    await expect(
      correctBirthForSupport({ birth: { month: 2, year: TEEN_YEAR }, userId: learner.id }),
    ).resolves.toStrictEqual({ status: "corrected" });

    await expect(
      prisma.userLearningProfile.findUniqueOrThrow({ where: { userId: learner.id } }),
    ).resolves.toMatchObject({ birthMonth: 2, birthYear: TEEN_YEAR });
  });

  it("deletes the account when the corrected age is under 13", async () => {
    const [admin, learner] = await Promise.all([userFixture({ role: "admin" }), userFixture()]);
    const goal = await goalFixture({ userId: learner.id });
    mockAdminSession(admin.id);

    await expect(
      correctBirthForSupport({
        birth: { month: 1, year: new Date().getUTCFullYear() - 10 },
        userId: learner.id,
      }),
    ).resolves.toStrictEqual({ status: "accountDeleted" });

    await expect(prisma.user.findUnique({ where: { id: learner.id } })).resolves.toBeNull();
    await expect(prisma.goal.findUnique({ where: { id: goal.id } })).resolves.toBeNull();
  });

  it("refuses impossible dates and unknown learners", async () => {
    const admin = await userFixture({ role: "admin" });
    mockAdminSession(admin.id);

    await expect(
      correctBirthForSupport({ birth: { month: 13, year: 1995 }, userId: admin.id }),
    ).resolves.toStrictEqual({ status: "invalid" });

    await expect(
      correctBirthForSupport({ birth: { month: 1, year: 1995 }, userId: "no-such-user" }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });

  it("is only for admins", async () => {
    const [learner, other] = await Promise.all([userFixture(), userFixture()]);
    await learningProfileFixture({ birthMonth: 4, birthYear: TEEN_YEAR, userId: learner.id });

    mockSession(null);

    await expect(
      correctBirthForSupport({ birth: { month: 4, year: 1995 }, userId: learner.id }),
    ).resolves.toStrictEqual({ status: "unauthorized" });

    mockSession(other.id);

    await expect(
      correctBirthForSupport({ birth: { month: 4, year: 1995 }, userId: learner.id }),
    ).resolves.toStrictEqual({ status: "forbidden" });

    await expect(
      prisma.userLearningProfile.findUniqueOrThrow({ where: { userId: learner.id } }),
    ).resolves.toMatchObject({ birthYear: TEEN_YEAR });
  });
});

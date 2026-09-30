import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockGuestSession, mockSession } from "../_test-utils/mock-session";
import { moveLanguageGoalToExam } from "./move-language-goal";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

describe(moveLanguageGoalToExam, () => {
  it("moves a language goal whose reason names a certificate to an exam goal", async () => {
    const user = await userFixture();

    const goal = await goalFixture({
      details: { reason: "vou fazer o IELTS em março" },
      kind: "language",
      prompt: "Aprender inglês",
      targetLanguage: "en",
      userId: user.id,
    });

    mockSession(user.id);
    const result = await moveLanguageGoalToExam(goal.id);

    expect(result).toMatchObject({
      goal: {
        details: { examName: "IELTS", movedFromGoalId: goal.id },
        kind: "exam",
        title: "IELTS",
      },
      status: "moved",
    });

    const [old, created] = await Promise.all([
      prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
      prisma.goal.findUniqueOrThrow({
        where: { id: result.status === "moved" ? result.goal.id : "" },
      }),
    ]);

    expect(old.status).toBe("archived");
    expect(created).toMatchObject({ kind: "exam", targetLanguage: "en" });
  });

  it("leaves goals without an exam alone", async () => {
    const user = await userFixture();

    const goal = await goalFixture({
      details: { reason: "to travel" },
      kind: "language",
      targetLanguage: "en",
      userId: user.id,
    });

    mockSession(user.id);

    await expect(moveLanguageGoalToExam(goal.id)).resolves.toStrictEqual({ status: "noExam" });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      status: "active",
    });
  });

  it("moves a guest's only goal too: the exam goal replaces it, it isn't another goal", async () => {
    const guest = await userFixture();

    const goal = await goalFixture({
      details: { reason: "vou fazer o IELTS em março" },
      kind: "language",
      targetLanguage: "en",
      userId: guest.id,
    });

    await Promise.all([
      prisma.user.update({ data: { isAnonymous: true }, where: { id: guest.id } }),
      usageRecordsFixture({ count: 1, kind: "goal", userId: guest.id }),
    ]);

    mockGuestSession(guest.id);

    await expect(moveLanguageGoalToExam(goal.id)).resolves.toMatchObject({
      goal: { kind: "exam", title: "IELTS" },
      status: "moved",
    });

    await expect(
      prisma.goal.count({ where: { status: "active", userId: guest.id } }),
    ).resolves.toBe(1);
  });
});

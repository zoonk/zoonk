import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockGuestSession, mockSession } from "../_test-utils/mock-session";
import { getAllowance } from "./get-allowance";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

const NOW = new Date("2026-09-15T12:00:00Z");
const EARLIER_THIS_MONTH = new Date("2026-09-03T09:00:00Z");

describe(getAllowance, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns nothing without a session", async () => {
    mockSession(null);

    await expect(getAllowance()).resolves.toBeNull();
  });

  it("shows a free learner's lessons today and this month with when they reset", async () => {
    const user = await userFixture();

    await Promise.all([
      usageRecordsFixture({ count: 3, createdAt: NOW, userId: user.id }),
      usageRecordsFixture({ count: 30, createdAt: EARLIER_THIS_MONTH, userId: user.id }),
      goalFixture({ userId: user.id }),
    ]);

    mockSession(user.id);
    const allowance = await getAllowance();

    expect(allowance).toMatchObject({
      activeGoals: { limit: 1, used: 1 },
      examPrep: { includesMockExams: false, studyDays: 7 },
      generatedLessons: null,
      resets: { day: new Date("2026-09-16T00:00:00Z"), month: new Date("2026-10-01T00:00:00Z") },
      tier: "free",
    });

    expect(allowance?.items.find((item) => item.kind === "lessonStart")).toStrictEqual({
      dailyLimit: 20,
      fairUseDailyLimit: null,
      kind: "lessonStart",
      monthlyLimit: 40,
      remaining: 7,
      totalLimit: null,
      usedThisMonth: 33,
      usedToday: 3,
      usedTotal: 33,
    });
  });

  it("shows Plus as fair use with no remaining count", async () => {
    const user = await userFixture();

    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    });

    mockSession(user.id);
    const allowance = await getAllowance();

    expect(allowance).toMatchObject({
      examPrep: { includesMockExams: true, studyDays: null },
      tier: "plus",
    });

    expect(allowance?.items.find((item) => item.kind === "lessonStart")).toMatchObject({
      dailyLimit: null,
      fairUseDailyLimit: 200,
      remaining: null,
    });
  });

  it("shows a guest's three lessons and one newly generated lesson", async () => {
    const guest = await userFixture();
    await usageRecordsFixture({ count: 1, createdAt: NOW, generated: true, userId: guest.id });

    mockGuestSession(guest.id);
    const allowance = await getAllowance();

    expect(allowance).toMatchObject({ generatedLessons: { limit: 1, used: 1 }, tier: "guest" });

    expect(allowance?.items.find((item) => item.kind === "lessonStart")).toMatchObject({
      remaining: 2,
      totalLimit: 3,
    });
  });
});

import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { sendEmail } from "@zoonk/mailer";
import {
  guardianLinkFixture,
  learningProfileFixture,
} from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getDailyTimeLimitStatus } from "../get-daily-time-limit";
import { getLearnerProtections } from "../get-learner-protections";
import { approvePlusPurchase } from "./approve-plus-purchase";
import { listGuardedLearners } from "./list-guarded-learners";
import { requestPlusApproval } from "./request-plus-approval";
import { setGuardianDailyLimit } from "./set-guardian-daily-limit";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => {} })),
  headers: vi.fn(async () => new Headers()),
}));

/** Email delivery is an external provider; the test reads the message instead of sending it. */
vi.mock("@zoonk/mailer", () => ({ sendEmail: vi.fn() }));

const TEEN_BIRTH = { birthMonth: 1, birthYear: new Date().getUTCFullYear() - 15 };

/** A teen with an accepted guardian who signs in with the invited, verified email. */
async function createGuardedTeen() {
  const [teen, guardian] = await Promise.all([userFixture({ name: "Ana" }), userFixture()]);

  await Promise.all([
    learningProfileFixture({ ...TEEN_BIRTH, userId: teen.id }),
    prisma.user.update({ data: { emailVerified: true }, where: { id: guardian.id } }),
  ]);

  const guardianLink = await guardianLinkFixture({
    acceptedAt: new Date(),
    guardianEmail: guardian.email,
    status: "active",
    userId: teen.id,
  });

  return { guardian, guardianLink, teen };
}

describe("guardian controls", () => {
  beforeEach(() => {
    vi.mocked(sendEmail).mockResolvedValue({ data: new Response(), error: null });
  });

  it("shows the guardian each learner's last seven days, never what they studied", async () => {
    const { guardian, teen } = await createGuardedTeen();
    const today = toUTCMidnight(new Date());

    await prisma.dailyProgress.createMany({
      data: [
        { date: today, dayOfWeek: 0, lessonsCompleted: 2, timeSpentSeconds: 1500, userId: teen.id },
        {
          date: new Date(today.getTime() - 3 * MS_PER_DAY),
          dayOfWeek: 0,
          lessonsCompleted: 1,
          timeSpentSeconds: 600,
          userId: teen.id,
        },
        {
          date: new Date(today.getTime() - 9 * MS_PER_DAY),
          dayOfWeek: 0,
          lessonsCompleted: 5,
          timeSpentSeconds: 3000,
          userId: teen.id,
        },
      ],
    });

    mockSession(guardian.id);
    const [learner] = (await listGuardedLearners()) ?? [];

    expect(learner).toMatchObject({
      learnerName: "Ana",
      weeklyActivity: { lessonsCompleted: 3, minutes: 35 },
    });

    expect(learner?.weeklyActivity.days).toHaveLength(7);

    expect(learner?.weeklyActivity.days.at(-1)).toStrictEqual({
      date: today,
      lessonsCompleted: 2,
      minutes: 25,
    });
  });

  it("lets the guardian set a daily limit that the learner's day is checked against", async () => {
    const { guardian, guardianLink, teen } = await createGuardedTeen();

    mockSession(teen.id);

    await expect(getDailyTimeLimitStatus()).resolves.toStrictEqual({
      limitMinutes: null,
      reached: false,
      remainingMinutes: null,
      usedMinutes: 0,
    });

    mockSession(guardian.id);

    await expect(
      setGuardianDailyLimit({ dailyLimitMinutes: 30, linkId: guardianLink.id }),
    ).resolves.toStrictEqual({ status: "updated" });

    await prisma.dailyProgress.create({
      data: {
        date: toUTCMidnight(new Date()),
        dayOfWeek: 0,
        timeSpentSeconds: 1860,
        userId: teen.id,
      },
    });

    mockSession(teen.id);

    await expect(getDailyTimeLimitStatus()).resolves.toStrictEqual({
      limitMinutes: 30,
      reached: true,
      remainingMinutes: 0,
      usedMinutes: 31,
    });
  });

  it("keeps other accounts away from a learner's controls", async () => {
    const [{ guardianLink }, stranger] = await Promise.all([createGuardedTeen(), userFixture()]);
    await prisma.user.update({ data: { emailVerified: true }, where: { id: stranger.id } });

    mockSession(stranger.id);

    await expect(
      setGuardianDailyLimit({ dailyLimitMinutes: 30, linkId: guardianLink.id }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await expect(approvePlusPurchase({ linkId: guardianLink.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    mockSession(null);

    await expect(approvePlusPurchase({ linkId: randomUUID() })).resolves.toStrictEqual({
      status: "unauthorized",
    });
  });

  it("protects a teen by default and lets them buy Plus after a guardian approves", async () => {
    const { guardian, guardianLink, teen } = await createGuardedTeen();

    mockSession(teen.id);

    await expect(getLearnerProtections()).resolves.toStrictEqual({
      ageGroup: "teen",
      marketingEmailAllowed: false,
      memoryCategories: ["goals", "learning"],
      plusPurchase: "needsGuardianApproval",
      sessionReplayAllowed: false,
    });

    await expect(requestPlusApproval()).resolves.toStrictEqual({ status: "requested" });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: guardian.email }));

    mockSession(guardian.id);

    await expect(approvePlusPurchase({ linkId: guardianLink.id })).resolves.toStrictEqual({
      status: "approved",
    });

    mockSession(teen.id);
    await expect(getLearnerProtections()).resolves.toMatchObject({ plusPurchase: "allowed" });
    await expect(requestPlusApproval()).resolves.toStrictEqual({ status: "notNeeded" });
  });

  it("asks a guest to create an account before asking a guardian to approve Plus", async () => {
    const guest = await userFixture();
    await prisma.user.update({ data: { isAnonymous: true }, where: { id: guest.id } });

    mockSession(guest.id);
    await expect(requestPlusApproval()).resolves.toStrictEqual({ status: "accountRequired" });

    mockSession(null);
    await expect(requestPlusApproval()).resolves.toStrictEqual({ status: "unauthorized" });
  });

  it("gives adults the full product and asks everyone else for their age first", async () => {
    const [adult, unknown] = await Promise.all([userFixture(), userFixture()]);
    await learningProfileFixture({ birthMonth: 1, birthYear: 1990, userId: adult.id });

    mockSession(adult.id);

    await expect(getLearnerProtections()).resolves.toMatchObject({
      ageGroup: "adult",
      memoryCategories: ["goals", "background", "routine", "preferences", "learning", "context"],
      plusPurchase: "allowed",
      sessionReplayAllowed: true,
    });

    mockSession(unknown.id);

    await expect(getLearnerProtections()).resolves.toMatchObject({
      ageGroup: "unknown",
      plusPurchase: "allowed",
      sessionReplayAllowed: false,
    });
  });
});

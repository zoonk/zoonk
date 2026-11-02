import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { describe, expect, it, vi } from "vitest";
import {
  createExistingAccount,
  createTestEmail,
  signInAsGuest,
  signInWithOneTimeToken,
  signInWithPassword,
  signUp,
} from "./_test-utils/guest-auth";
import { countLearnerRows, createSkill, seedLearnerData } from "./_test-utils/learner-data";

/** BotID only classifies requests on Vercel, so tests stand in for its verdict. */
vi.mock("botid/server", () => ({ checkBotId: vi.fn().mockResolvedValue({ isBot: false }) }));

const THIRTY_DAYS_MS = 2_592_000_000;

function daysAgo(milliseconds: number) {
  return new Date(Date.now() - milliseconds);
}

describe("guest accounts", () => {
  it("creates a guest as an anonymous user with learner progress", async () => {
    const { guestId } = await signInAsGuest();

    const guest = await prisma.user.findUniqueOrThrow({
      include: { progress: true },
      where: { id: guestId },
    });

    expect(guest.isAnonymous).toBe(true);
    expect(guest.progress).not.toBeNull();
  });

  it("moves a guest's learning to the account created at sign-up and deletes the guest", async () => {
    const [{ guestId, headers }, skill] = await Promise.all([signInAsGuest(), createSkill()]);

    const { goal } = await seedLearnerData({
      brainPower: 5,
      contentId: randomUUID(),
      skillId: skill.id,
      userId: guestId,
    });

    const { userId } = await signUp({ email: createTestEmail(), headers });

    await expect(countLearnerRows(userId)).resolves.toStrictEqual({
      aiCalls: 1,
      attempts: 1,
      conversations: 1,
      days: 1,
      drafts: 1,
      evaluations: 1,
      events: 1,
      examResults: 1,
      feedback: 1,
      goals: 1,
      memory: 1,
      milestones: 1,
      mocks: 1,
      patterns: 1,
      skills: 1,
      usage: 1,
    });

    await expect(
      prisma.userLearningProfile.findUnique({ where: { userId } }),
    ).resolves.toMatchObject({ activeGoalId: goal.id, buddyKind: "zu", buddyName: "Zuzu" });

    await expect(prisma.plan.findUnique({ where: { goalId: goal.id } })).resolves.not.toBeNull();

    await expect(prisma.userProgress.findUnique({ where: { userId } })).resolves.toMatchObject({
      totalBrainPower: 5n,
    });

    await expect(prisma.user.findUnique({ where: { id: guestId } })).resolves.toBeNull();
  });

  it("keeps an existing account's rows on a clash and adds the guest's day and Brain Power", async () => {
    const [account, guest, skill] = await Promise.all([
      createExistingAccount({ createdAt: daysAgo(THIRTY_DAYS_MS) }),
      signInAsGuest(),
      createSkill(),
    ]);

    const contentId = randomUUID();
    const shared = { contentId, skillId: skill.id };

    await seedLearnerData({ ...shared, brainPower: 10, userId: account.userId });
    const { goal } = await seedLearnerData({ ...shared, brainPower: 1, userId: guest.guestId });

    await signInWithPassword({ email: account.email, headers: guest.headers });

    await expect(countLearnerRows(account.userId)).resolves.toMatchObject({
      attempts: 2,
      conversations: 2,
      days: 1,
      drafts: 2,
      evaluations: 2,
      examResults: 2,
      goals: 2,
      milestones: 1,
      mocks: 2,
      patterns: 2,
      skills: 1,
      usage: 2,
    });

    const [learnerSkill, day, progress, profile] = await Promise.all([
      prisma.learnerSkill.findFirstOrThrow({ where: { userId: account.userId } }),
      prisma.dailyProgress.findFirstOrThrow({ where: { userId: account.userId } }),
      prisma.userProgress.findUniqueOrThrow({ where: { userId: account.userId } }),
      prisma.userLearningProfile.findUniqueOrThrow({ where: { userId: account.userId } }),
    ]);

    expect(learnerSkill.reps).toBe(10);
    expect(day.brainPowerEarned).toBe(11);
    expect(progress.totalBrainPower).toBe(11n);
    expect(profile.activeGoalId).toBe(goal.id);
    await expect(prisma.user.findUnique({ where: { id: guest.guestId } })).resolves.toBeNull();
  });

  it("links a guest when the sign-in comes back to the app through a one-time token", async () => {
    const [account, guest, skill] = await Promise.all([
      createExistingAccount({ createdAt: daysAgo(THIRTY_DAYS_MS) }),
      signInAsGuest(),
      createSkill(),
    ]);

    await seedLearnerData({
      brainPower: 3,
      contentId: randomUUID(),
      skillId: skill.id,
      userId: guest.guestId,
    });

    await signInWithOneTimeToken({ email: account.email, guestHeaders: guest.headers });

    await expect(countLearnerRows(account.userId)).resolves.toMatchObject({ goals: 1, skills: 1 });
    await expect(prisma.user.findUnique({ where: { id: guest.guestId } })).resolves.toBeNull();
  });
});

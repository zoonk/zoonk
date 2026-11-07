import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockAccountSession, mockGuestSession, mockSession } from "../_test-utils/mock-session";
import { claimStudyReminderOffer } from "./claim-study-reminder-offer";
import { signStudyReminderUnsubscribeToken, turnOffStudyReminderEmail } from "./email-unsubscribe";
import { getStudyReminder } from "./get-study-reminder";
import { removeStudyReminderPhone, selectStudyReminderPhone } from "./study-reminder-phone";
import { updateStudyReminder } from "./update-study-reminder";

async function accountLearner() {
  const user = await userFixture();
  mockAccountSession({ user });
  return user;
}

function phone(label = "Ana's iPhone") {
  return { label, locale: "en" as const, platform: "ios" as const, token: `token-${randomUUID()}` };
}

describe("study reminder settings", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads defaults from the active goal without saving anything", async () => {
    const user = await accountLearner();

    const goal = await goalFixture({
      studyTime: "07:30",
      timezone: "America/Sao_Paulo",
      userId: user.id,
    });

    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });

    await expect(getStudyReminder()).resolves.toStrictEqual({
      email: { address: user.email, on: false },
      push: { on: false, phone: null },
      quiet: false,
      time: "07:30",
      timeZone: "America/Sao_Paulo",
    });

    await expect(prisma.studyReminder.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("rounds a goal's study time to the quarter hour reminders go out on", async () => {
    const user = await accountLearner();
    const goal = await goalFixture({ studyTime: "07:38", userId: user.id });
    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });

    await expect(getStudyReminder()).resolves.toMatchObject({ time: "07:45" });

    await prisma.goal.update({ data: { studyTime: "23:53" }, where: { id: goal.id } });
    await expect(getStudyReminder()).resolves.toMatchObject({ time: "23:45" });
  });

  it("refuses a time off the quarter hour", async () => {
    const user = await accountLearner();

    await expect(updateStudyReminder({ locale: "en", time: "19:10" })).resolves.toStrictEqual({
      status: "timeNotOnQuarterHour",
    });

    await expect(prisma.studyReminder.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("returns null without a session", async () => {
    mockSession(null);
    await expect(getStudyReminder()).resolves.toBeNull();
  });

  it("changes only the fields sent and stamps when a channel turns on", async () => {
    const user = await accountLearner();

    const first = await updateStudyReminder({ locale: "pt", time: "21:15" });

    expect(first).toMatchObject({
      reminder: { email: { on: false }, time: "21:15", timeZone: "UTC" },
      status: "updated",
    });

    const before = await prisma.studyReminder.findUniqueOrThrow({ where: { userId: user.id } });
    expect(before).toMatchObject({ enabledAt: null, locale: "pt", time: "21:15" });

    await expect(updateStudyReminder({ emailOn: true, locale: "en" })).resolves.toMatchObject({
      reminder: { email: { address: user.email, on: true }, time: "21:15" },
    });

    const after = await prisma.studyReminder.findUniqueOrThrow({ where: { userId: user.id } });
    expect(after).toMatchObject({ emailOn: true, locale: "en", time: "21:15" });
    expect(after.enabledAt).toBeInstanceOf(Date);
  });

  it("doesn't save a language alone for a learner who never saved reminders", async () => {
    const user = await accountLearner();

    await expect(updateStudyReminder({ locale: "pt" })).resolves.toMatchObject({
      status: "updated",
    });

    await expect(prisma.studyReminder.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("needs an account for email and a selected phone for push", async () => {
    const guest = await userFixture();
    mockGuestSession(guest.id);

    await expect(updateStudyReminder({ emailOn: true, locale: "en" })).resolves.toStrictEqual({
      status: "accountRequired",
    });

    await expect(updateStudyReminder({ locale: "en", pushOn: true })).resolves.toStrictEqual({
      status: "phoneRequired",
    });

    await selectStudyReminderPhone(phone());

    await expect(updateStudyReminder({ locale: "en", pushOn: true })).resolves.toMatchObject({
      reminder: { email: { address: null, on: false }, push: { on: true } },
      status: "updated",
    });
  });

  it("goes quiet after 7 days without study, and studying wakes it", async () => {
    const user = await accountLearner();

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
    await updateStudyReminder({ emailOn: true, locale: "en" });

    vi.setSystemTime(new Date("2026-10-08T12:00:00Z"));
    await expect(getStudyReminder()).resolves.toMatchObject({ quiet: false });

    vi.setSystemTime(new Date("2026-10-09T12:00:00Z"));
    await expect(getStudyReminder()).resolves.toMatchObject({ quiet: true });

    await dailyProgressFixtureMany([
      { date: new Date("2026-10-09T00:00:00Z"), timeSpentSeconds: 60, userId: user.id },
    ]);

    await expect(getStudyReminder()).resolves.toMatchObject({ quiet: false });
  });
});

describe("study reminder offer", () => {
  it("is claimed once, creating the row", async () => {
    const user = await accountLearner();

    await expect(claimStudyReminderOffer({ locale: "ko" })).resolves.toStrictEqual({
      claimed: true,
      status: "ready",
    });

    await expect(claimStudyReminderOffer({ locale: "ko" })).resolves.toStrictEqual({
      claimed: false,
      status: "ready",
    });

    const reminder = await prisma.studyReminder.findUniqueOrThrow({ where: { userId: user.id } });
    expect(reminder).toMatchObject({ emailOn: false, locale: "ko", pushOn: false, time: "19:00" });
    expect(reminder.offeredAt).toBeInstanceOf(Date);
  });

  it("lets only one of two concurrent claims win", async () => {
    await accountLearner();

    const results = await Promise.all([
      claimStudyReminderOffer({ locale: "en" }),
      claimStudyReminderOffer({ locale: "en" }),
    ]);

    expect(results.filter((result) => "claimed" in result && result.claimed)).toHaveLength(1);
  });
});

describe("study reminder phone", () => {
  it("moves a device from the account that had it, keeping push on for its new owner", async () => {
    const [previous, current] = await Promise.all([userFixture(), userFixture()]);
    const device = phone();

    mockAccountSession({ user: previous });
    await selectStudyReminderPhone(device);
    await updateStudyReminder({ locale: "en", pushOn: true });

    mockAccountSession({ user: current });

    await expect(
      selectStudyReminderPhone({ ...device, label: "Shared iPad" }),
    ).resolves.toMatchObject({
      reminder: { push: { on: false, phone: { label: "Shared iPad", token: device.token } } },
    });

    await expect(
      prisma.studyReminder.findUniqueOrThrow({ where: { userId: previous.id } }),
    ).resolves.toMatchObject({ pushLabel: null, pushOn: false, pushToken: null });
  });

  it("removes the phone only while it's the one it names", async () => {
    await accountLearner();
    const old = phone("Old phone");
    const replacement = phone("New phone");

    await selectStudyReminderPhone(old);
    await selectStudyReminderPhone(replacement);
    await updateStudyReminder({ locale: "en", pushOn: true });

    await expect(removeStudyReminderPhone(old.token)).resolves.toMatchObject({
      reminder: { push: { on: true, phone: { token: replacement.token } } },
    });

    await expect(removeStudyReminderPhone(replacement.token)).resolves.toMatchObject({
      reminder: { push: { on: false, phone: null } },
    });
  });
});

describe("study reminder email unsubscribe", () => {
  it("turns only email off, as often as it's used", async () => {
    const user = await accountLearner();

    await selectStudyReminderPhone(phone());
    await updateStudyReminder({ emailOn: true, locale: "en", pushOn: true });

    const token = signStudyReminderUnsubscribeToken(user.id);

    await expect(turnOffStudyReminderEmail(token)).resolves.toBe("off");
    await expect(turnOffStudyReminderEmail(token)).resolves.toBe("off");

    await expect(
      prisma.studyReminder.findUniqueOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ emailOn: false, pushOn: true });
  });

  it("refuses a token that wasn't signed for that account", async () => {
    const [user, other] = await Promise.all([accountLearner(), userFixture()]);
    await updateStudyReminder({ emailOn: true, locale: "en" });

    const [, signature] = signStudyReminderUnsubscribeToken(other.id).split(".");

    await expect(turnOffStudyReminderEmail(`${user.id}.${signature}`)).resolves.toBe("invalid");
    await expect(turnOffStudyReminderEmail(user.id)).resolves.toBe("invalid");
    await expect(turnOffStudyReminderEmail("not-a-token")).resolves.toBe("invalid");

    await expect(
      prisma.studyReminder.findUniqueOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ emailOn: true });
  });
});

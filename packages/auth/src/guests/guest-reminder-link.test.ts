import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { createLearner } from "./_test-utils/learner-data";
import { linkGuestAccount } from "./link-guest-account";

const EARLY = new Date("2026-09-01T10:00:00Z");
const LATE = new Date("2026-09-05T10:00:00Z");
const MONDAY = new Date("2026-09-07T00:00:00Z");
const TUESDAY = new Date("2026-09-08T00:00:00Z");

describe("guest study reminder linking", () => {
  it("moves the guest's reminder, phone included, to an account without one", async () => {
    const [accountId, guestId] = await Promise.all([
      createLearner({ isAnonymous: false }),
      createLearner({ isAnonymous: true }),
    ]);

    const token = `guest-phone-${randomUUID()}`;

    await prisma.studyReminder.create({
      data: {
        enabledAt: EARLY,
        locale: "pt",
        offeredAt: EARLY,
        processedOn: MONDAY,
        pushLabel: "Phone",
        pushOn: true,
        pushPlatform: "ios",
        pushToken: token,
        time: "07:30",
        userId: guestId,
      },
    });

    await linkGuestAccount({ account: { id: accountId }, guestUserId: guestId });

    const reminder = await prisma.studyReminder.findUniqueOrThrow({ where: { userId: accountId } });

    expect(reminder).toMatchObject({
      locale: "pt",
      offeredAt: EARLY,
      processedOn: MONDAY,
      pushOn: true,
      pushToken: token,
      time: "07:30",
    });
  });

  it("keeps the account's choices, the earliest offer and the latest processed day", async () => {
    const [accountId, guestId] = await Promise.all([
      createLearner({ isAnonymous: false }),
      createLearner({ isAnonymous: true }),
    ]);

    await Promise.all([
      prisma.studyReminder.create({
        data: {
          emailOn: true,
          locale: "en",
          offeredAt: LATE,
          processedOn: MONDAY,
          time: "20:00",
          userId: accountId,
        },
      }),
      prisma.studyReminder.create({
        data: {
          locale: "pt",
          offeredAt: EARLY,
          processedOn: TUESDAY,
          pushLabel: "Phone",
          pushOn: true,
          pushPlatform: "android",
          pushToken: `guest-phone-${randomUUID()}`,
          time: "07:30",
          userId: guestId,
        },
      }),
    ]);

    await linkGuestAccount({ account: { id: accountId }, guestUserId: guestId });

    const reminders = await prisma.studyReminder.findMany({
      where: { userId: { in: [accountId, guestId] } },
    });

    expect(reminders).toStrictEqual([
      expect.objectContaining({
        emailOn: true,
        locale: "en",
        offeredAt: EARLY,
        processedOn: TUESDAY,
        pushOn: false,
        pushToken: null,
        time: "20:00",
        userId: accountId,
      }),
    ]);
  });
});

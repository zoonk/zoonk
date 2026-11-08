import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { createLearner } from "./_test-utils/learner-data";
import { linkGuestAccount } from "./link-guest-account";

describe("guest linking from another of the guest's devices", () => {
  it("does not hand a phone whose guest session is ending to the linking device's account session", async () => {
    const [accountId, guestId] = await Promise.all([
      createLearner({ isAnonymous: false }),
      createLearner({ isAnonymous: true }),
    ]);

    const [phoneGuestSession, tabletGuestSession, tabletAccountSession] = await Promise.all([
      prisma.session.create({
        data: { expiresAt: new Date("2099-01-01"), token: randomUUID(), userId: guestId },
      }),
      prisma.session.create({
        data: { expiresAt: new Date("2099-01-01"), token: randomUUID(), userId: guestId },
      }),
      prisma.session.create({
        data: { expiresAt: new Date("2099-01-01"), token: randomUUID(), userId: accountId },
      }),
    ]);

    await prisma.studyReminder.create({
      data: {
        locale: "en",
        pushLabel: "Phone 1",
        pushOn: true,
        pushPlatform: "android",
        pushSessionId: phoneGuestSession.id,
        pushToken: randomUUID(),
        time: "19:00",
        userId: guestId,
      },
    });

    await linkGuestAccount({
      account: { id: accountId },
      guestSessionId: tabletGuestSession.id,
      guestUserId: guestId,
      sessionId: tabletAccountSession.id,
    });

    await expect(
      prisma.session.findUnique({ where: { id: phoneGuestSession.id } }),
    ).resolves.toBeNull();

    await expect(
      prisma.studyReminder.findUniqueOrThrow({ where: { userId: accountId } }),
    ).resolves.toMatchObject({ pushSessionId: null });
  });
});

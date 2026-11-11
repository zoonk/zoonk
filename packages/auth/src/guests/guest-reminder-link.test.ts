import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { describe, expect, it, vi } from "vitest";
import {
  createTestEmail,
  guestAuth,
  signInAsGuest,
  signInWithOneTimeToken,
  signInWithPassword,
  signUp,
} from "./_test-utils/guest-auth";
import { createLearner } from "./_test-utils/learner-data";
import { linkGuestAccount } from "./link-guest-account";

const EARLY = new Date("2026-09-01T10:00:00Z");
const LATE = new Date("2026-09-05T10:00:00Z");
const MONDAY = new Date("2026-09-07T00:00:00Z");
const TUESDAY = new Date("2026-09-08T00:00:00Z");

/** BotID only classifies requests on Vercel, so tests stand in for its verdict. */
vi.mock("botid/server", () => ({ checkBotId: vi.fn().mockResolvedValue({ isBot: false }) }));

describe("guest study reminder linking", () => {
  it("moves the guest's reminder, phone included, to an account without one", async () => {
    const { guestId, headers } = await signInAsGuest();
    const guestSession = await guestAuth.api.getSession({ headers });

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
        pushSessionId: guestSession!.session.id,
        pushToken: token,
        time: "07:30",
        userId: guestId,
      },
    });

    const account = await signUp({ email: createTestEmail(), headers });
    const accountSession = await guestAuth.api.getSession({ headers: account.headers });
    const accountId = account.userId;

    const reminder = await prisma.studyReminder.findUniqueOrThrow({ where: { userId: accountId } });

    expect(reminder).toMatchObject({
      locale: "pt",
      offeredAt: EARLY,
      processedOn: MONDAY,
      pushOn: true,
      pushSessionId: accountSession!.session.id,
      pushToken: token,
      time: "07:30",
    });

    await expect(
      prisma.session.findUnique({ where: { id: guestSession!.session.id } }),
    ).resolves.toBeNull();

    await prisma.session.delete({ where: { id: accountSession!.session.id } });

    await expect(
      prisma.studyReminder.findUniqueOrThrow({ where: { userId: accountId } }),
    ).resolves.toMatchObject({ pushSessionId: null });
  });

  it.each(["password", "token"] as const)(
    "keeps a guest phone when linking through %s sign-in",
    async (method) => {
      const email = createTestEmail();
      const account = await signUp({ email });
      const { guestId, headers } = await signInAsGuest();
      const guestSession = await guestAuth.api.getSession({ headers });

      await prisma.studyReminder.create({
        data: {
          locale: "en",
          pushLabel: "Phone",
          pushOn: true,
          pushPlatform: "android",
          pushSessionId: guestSession!.session.id,
          pushToken: randomUUID(),
          time: "19:00",
          userId: guestId,
        },
      });

      const token =
        method === "password"
          ? await signInWithPassword({ email, headers }).then((signedIn) => signedIn.token)
          : await signInWithOneTimeToken({ email, guestHeaders: headers }).then(
              (signedIn) => signedIn.session.token,
            );

      const session = await prisma.session.findUniqueOrThrow({ where: { token } });

      await expect(
        prisma.studyReminder.findUniqueOrThrow({ where: { userId: account.userId } }),
      ).resolves.toMatchObject({ pushOn: true, pushSessionId: session.id });
    },
  );

  it("rebinds a retained account phone registered by the guest session", async () => {
    const [accountId, guestId] = await Promise.all([
      createLearner({ isAnonymous: false }),
      createLearner({ isAnonymous: true }),
    ]);

    const [accountSession, guestSession] = await Promise.all(
      [accountId, guestId].map((userId) =>
        prisma.session.create({
          data: { expiresAt: new Date("2099-01-01"), token: randomUUID(), userId },
        }),
      ),
    );

    await prisma.studyReminder.create({
      data: {
        locale: "en",
        pushLabel: "Phone",
        pushOn: true,
        pushPlatform: "ios",
        pushSessionId: guestSession!.id,
        pushToken: randomUUID(),
        time: "20:00",
        userId: accountId,
      },
    });

    await linkGuestAccount({
      account: { id: accountId },
      guestSessionId: guestSession!.id,
      guestUserId: guestId,
      sessionId: accountSession!.id,
    });

    await expect(
      prisma.studyReminder.findUniqueOrThrow({ where: { userId: accountId } }),
    ).resolves.toMatchObject({ pushOn: true, pushSessionId: accountSession!.id, time: "20:00" });
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

import { generateKeyPairSync, randomUUID } from "node:crypto";
import { claimStudyReminder } from "@zoonk/core/reminders/send";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, assert, beforeEach, describe, expect, it, vi } from "vitest";
import { RetryableError } from "workflow";
import { sendStudyReminderPushStep } from "./steps/study-reminder-steps";
import { studyReminderWorkflow } from "./study-reminder-workflow";

type Values = Record<string, number | string>;
type Extracted = string | { message: string; values?: Values };

// The extractor turns `t("…")` into catalog lookups only in a Next build; tests format the English.
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");

  return {
    getExtracted: async () => (input: Extracted, values?: Values) => {
      const { message, values: inline } = typeof input === "string" ? { message: input } : input;
      return createTranslator({ locale: "en", messages: { message } })("message", inline ?? values);
    },
  };
});

const AT_SEVEN_TEN = new Date("2026-10-07T19:10:00Z");

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { format: "pem", type: "pkcs8" },
  publicKeyEncoding: { format: "pem", type: "spki" },
});

async function dueLearner() {
  const user = await userFixture();
  const fid = `fid-${randomUUID()}`;

  const pushSession = await prisma.session.create({
    data: { expiresAt: new Date("2099-01-01"), token: randomUUID(), userId: user.id },
  });

  const goal = await goalFixture({
    createdAt: new Date("2026-10-01T12:00:00Z"),
    dailyMinutes: 25,
    timezone: "UTC",
    title: "Italian",
    userId: user.id,
  });

  await Promise.all([
    planFixture({ goalId: goal.id }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    prisma.studyReminder.create({
      data: {
        emailOn: true,
        enabledAt: new Date("2026-10-06T12:00:00Z"),
        locale: "en",
        pushLabel: "Pixel",
        pushOn: true,
        pushPlatform: "android",
        pushSessionId: pushSession.id,
        pushToken: fid,
        time: "19:00",
        userId: user.id,
      },
    }),
  ]);

  return { fid, goal, pushSession, user };
}

/** A delivery step's input, as the workflow persists it from today's claim. */
async function claimToday(userId: string) {
  const claim = await claimStudyReminder({ now: new Date(), userId });
  assert(claim.status === "claimed");
  return { claim: { endsAt: claim.endsAt, localDate: claim.localDate }, userId };
}

function urlOf(input: RequestInfo | URL): string {
  return input instanceof Request ? input.url : input.toString();
}

/** Google's token endpoint, FCM and the local mailbox are the only places a reminder reaches. */
function fakeProviders(fcm: () => Response) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = urlOf(input);

    if (url.startsWith("https://oauth2.googleapis.com/token")) {
      return Response.json({ access_token: "google-token", expires_in: 3600 });
    }

    if (url.startsWith("https://fcm.googleapis.com/")) {
      return fcm();
    }

    return Response.json({ ok: true });
  });
}

function sentBody(fetch: ReturnType<typeof fakeProviders>, prefix: string): unknown {
  const body = fetch.mock.calls.find(([input]) => urlOf(input).startsWith(prefix))?.[1]?.body;
  return JSON.parse(typeof body === "string" ? body : "");
}

describe(studyReminderWorkflow, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AT_SEVEN_TEN);
    vi.stubEnv("MAILER_REMINDERS_API_KEY", "");

    vi.stubEnv(
      "FIREBASE_SERVICE_ACCOUNT_KEY",
      JSON.stringify({
        client_email: "fcm@zoonk-test.iam.gserviceaccount.com",
        private_key: privateKey,
        project_id: "zoonk-test",
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("emails and pushes the day's reminder once, opening Today on the goal with work", async () => {
    const { fid, goal, user } = await dueLearner();
    const fetch = fakeProviders(() => Response.json({ name: "projects/zoonk-test/messages/1" }));

    await expect(studyReminderWorkflow({ userId: user.id })).resolves.toStrictEqual({
      claim: "claimed",
      email: "sent",
      push: "sent",
    });

    expect(sentBody(fetch, "https://fcm.googleapis.com/")).toStrictEqual({
      message: {
        android: {
          notification: { channel_id: "study_reminders", tag: "study-reminder" },
          ttl: "3000s",
        },
        data: { goalId: goal.id, type: "study_reminder" },
        fid,
        notification: {
          body: expect.stringContaining("25 minutes"),
          title: expect.stringContaining("Italian"),
        },
      },
    });

    expect(sentBody(fetch, "http://")).toMatchObject({
      headers: {
        "List-Unsubscribe": expect.stringMatching(
          /^<.+\/v1\/unsubscribe\/study-reminders\?token=.+>$/u,
        ),
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      htmlBody: expect.stringContaining(`/today?goal=${goal.id}`),
      sender: "reminders",
      textBody: expect.stringMatching(
        /You get this because you turned on study reminders in Zoonk\.[\s\S]*Change reminder settings: \S+\/settings\/reminders/u,
      ),
      to: user.email,
    });

    await expect(studyReminderWorkflow({ userId: user.id })).resolves.toStrictEqual({
      claim: "notDue",
    });
  });

  it("drops a phone FCM no longer knows, keeping email on", async () => {
    const { user } = await dueLearner();
    fakeProviders(() => Response.json({ error: { status: "NOT_FOUND" } }, { status: 404 }));

    await expect(studyReminderWorkflow({ userId: user.id })).resolves.toMatchObject({
      push: "gone",
    });

    await expect(
      prisma.studyReminder.findUniqueOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ emailOn: true, pushOn: false, pushToken: null });
  });

  it.each(["deleted", "expired"] as const)(
    "does not contact push providers after the registered session is %s",
    async (state) => {
      const { pushSession, user } = await dueLearner();
      const pending = await claimToday(user.id);
      const fetch = fakeProviders(() => Response.json({ name: "projects/zoonk-test/messages/1" }));

      if (state === "deleted") {
        await prisma.session.delete({ where: { id: pushSession.id } });
      } else {
        await prisma.session.update({
          data: { expiresAt: AT_SEVEN_TEN },
          where: { id: pushSession.id },
        });
      }

      await expect(sendStudyReminderPushStep(pending)).resolves.toBe("notNeeded");
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("retries a push FCM asked to send later, after the wait it named", async () => {
    const { user } = await dueLearner();

    fakeProviders(() => new Response(null, { headers: { "Retry-After": "30" }, status: 503 }));

    const failure = await sendStudyReminderPushStep(await claimToday(user.id)).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(RetryableError);
    expect(failure).toMatchObject({ retryAfter: new Date(AT_SEVEN_TEN.getTime() + 30_000) });
  });

  it("sends nothing from yesterday's pending retry once today's reminder went out", async () => {
    const { user } = await dueLearner();
    const accepted: string[] = [];
    const fcm = { available: false };

    fakeProviders(() => {
      if (!fcm.available) {
        return new Response(null, { headers: { "Retry-After": "30" }, status: 503 });
      }

      accepted.push(new Date().toISOString());
      return Response.json({ name: "projects/zoonk-test/messages/1" });
    });

    const pending = await claimToday(user.id);
    await expect(sendStudyReminderPushStep(pending)).rejects.toBeInstanceOf(RetryableError);

    vi.setSystemTime(new Date("2026-10-08T19:10:00Z"));
    fcm.available = true;

    await expect(studyReminderWorkflow({ userId: user.id })).resolves.toMatchObject({
      claim: "claimed",
      push: "sent",
    });

    await expect(sendStudyReminderPushStep(pending)).resolves.toBe("notNeeded");
    expect(accepted).toHaveLength(1);
  });
});

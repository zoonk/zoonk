import { generateKeyPairSync, randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RetryableError } from "workflow";
import { sendStudyReminderPushStep } from "./steps/study-reminder-steps";
import { studyReminderWorkflow } from "./study-reminder-workflow";

// The extractor turns `t("…")` into catalog lookups only in a Next build; tests format the English.
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");

  return {
    getExtracted: async () => (message: string, values?: Record<string, number | string>) =>
      createTranslator({ locale: "en", messages: { message } })("message", values),
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

  const goal = await goalFixture({
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
        pushToken: fid,
        time: "19:00",
        userId: user.id,
      },
    }),
  ]);

  return { fid, goal, user };
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

  it("retries a push FCM asked to send later, after the wait it named", async () => {
    const { user } = await dueLearner();

    fakeProviders(() => new Response(null, { headers: { "Retry-After": "30" }, status: 503 }));

    const failure = await sendStudyReminderPushStep(user.id).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(RetryableError);
    expect(failure).toMatchObject({ retryAfter: new Date(AT_SEVEN_TEN.getTime() + 30_000) });
  });
});
